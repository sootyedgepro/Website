// POST /api/analyze
// Grades a trade setup with Dex (Claude Sonnet 4.6) + Yahoo OHLCV + optional
// Polygon options/earnings context. Mirrors /api/chat/index.js conventions:
// CommonJS, in-process state, Anthropic SDK v0.80.0.
//
// Body: { ticker: string, timeframe?: "1d"|"1h"|"15m"|"5m", range?: "1y"|"6mo"|"3mo",
//         email: string, userContext?: string }
// Returns: 200 { gradeId, grade, riskReward, setupType, regime, entry, stopLoss,
//                takeProfits:[tp1,tp2,tp3], whyThisWorks, whatYoureLearning, riskAlert,
//                meta:{ price, indicators, supportResistance, ivContext, catalysts,
//                       promptVersion, modelVersion, cacheHit } }
//         403 { error } — non-member
//         429 { error, retryAfterSec } — rate limit
//         502 { error } — upstream data fetch failed
//         500 { error } — Anthropic / unknown

const Anthropic = require("@anthropic-ai/sdk");
const { PROMPT, PROMPT_VERSION } = require("../_lib/dex-prompt");
const { fetchYahooOHLCV, fetchYahooQuote } = require("../_lib/yahoo");
const { getATMIV, getEarningsCalendar, ENABLED: POLYGON_ON } = require("../_lib/polygon");
const indicators = require("../_lib/indicators");
const airtable = require("../_lib/airtable");
const rateLimit = require("../_lib/rate-limit");
const { applyCors, clientIp, isValidEmail } = require("../_lib/cors");

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;
const PHASE_2_OPEN_MEMBERSHIP = true; // Phase 3 flips this to enforce gating

const API_DIRECTIVE = `Emit your human-readable grade per the canonical output format, then append a JSON block in this EXACT shape so the API can parse it. The JSON values must match the human-readable lines verbatim where applicable. Do not include the JSON block in any text the user sees — wrap it cleanly so it can be stripped:

<DEX_GRADE>
{
  "grade": "A|B|C|D|F",
  "risk_reward": "1:3",
  "setup_type": "breakout|pullback|reversal|range|momentum|mean-reversion",
  "regime": "trending|chop|volatile|quiet",
  "entry": <number>,
  "entry_reason": "...",
  "stop_loss": <number>,
  "stop_reason": "...",
  "tp1": <number>, "tp1_reason": "...",
  "tp2": <number>, "tp2_reason": "...",
  "tp3": <number>, "tp3_reason": "...",
  "why_this_works": "...",
  "what_youre_learning": "...",
  "risk_alert": "..."
}
</DEX_GRADE>`;

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  const {
    ticker: rawTicker,
    timeframe = "1d",
    range = "1y",
    email,
    userContext = "",
  } = req.body || {};

  const ticker = typeof rawTicker === "string" ? rawTicker.trim().toUpperCase() : null;
  if (!ticker || !/^[A-Z][A-Z0-9.\-]{0,9}$/.test(ticker)) {
    return res.status(400).json({ error: "ticker required (e.g. AAPL, BRK.B)" });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "valid email required" });
  }
  const normalizedEmail = email.trim().toLowerCase();

  // ── Rate limit: per-IP floor + per-email ceiling ──────────────────────
  const ip = clientIp(req);
  const rl = rateLimit.check({ email: normalizedEmail, ip });
  if (!rl.allowed) {
    res.setHeader("Retry-After", String(rl.retryAfterSec));
    return res.status(429).json({
      error: "Rate limit exceeded. Slow down — Dex is for thinking, not spamming.",
      retryAfterSec: rl.retryAfterSec,
    });
  }

  // ── Membership gating (Phase 2 stub) ──────────────────────────────────
  let memberRec = null;
  try {
    memberRec = await airtable.findMember(normalizedEmail);
    if (!PHASE_2_OPEN_MEMBERSHIP && !airtable.isActiveMember(memberRec)) {
      return res.status(403).json({
        error: "Active SootyEdge membership required.",
      });
    }
  } catch (err) {
    console.warn("[analyze] membership lookup failed:", err.message);
  }

  // ── Fetch market data ─────────────────────────────────────────────────
  let candlesDaily, candlesIntraday, quote;
  try {
    [candlesDaily, quote] = await Promise.all([
      fetchYahooOHLCV(ticker, { interval: "1d", range }),
      fetchYahooQuote(ticker),
    ]);
    if (timeframe !== "1d") {
      try {
        candlesIntraday = await fetchYahooOHLCV(ticker, {
          interval: timeframe,
          range: timeframe === "1h" ? "1mo" : "5d",
        });
      } catch (err) {
        console.warn(`[analyze] intraday fetch failed: ${err.message}`);
      }
    }
  } catch (err) {
    return res.status(502).json({
      error: `Couldn't fetch market data for ${ticker}: ${err.message}`,
    });
  }

  const daily = candlesDaily.candles;
  if (!daily || daily.length < 30) {
    return res.status(502).json({
      error: `Not enough OHLCV history for ${ticker} to grade reliably.`,
    });
  }

  // ── Compute indicators ────────────────────────────────────────────────
  const rsiOut = indicators.rsi(daily);
  const macdOut = indicators.macd(daily);
  const atrOut = indicators.atr(daily);
  const ema20 = indicators.ema(daily, 20);
  const ema50 = indicators.ema(daily, 50);
  const ema200 = indicators.ema(daily, 200);
  const boll = indicators.bollinger(daily);
  const zones = indicators.supportResistanceZones(daily, quote.price);

  // ── Optional Polygon enrichment ───────────────────────────────────────
  let ivCtx = null;
  let catalysts = null;
  if (POLYGON_ON) {
    [ivCtx, catalysts] = await Promise.all([
      getATMIV(ticker, quote.price),
      getEarningsCalendar(ticker),
    ]);
  }

  // ── Build user-message context block (NOT cached) ─────────────────────
  const contextBlock = buildContextBlock({
    ticker,
    timeframe,
    quote,
    daily,
    candlesIntraday: candlesIntraday?.candles,
    indicators: { rsi: rsiOut, macd: macdOut, atr: atrOut, ema20, ema50, ema200, boll },
    zones,
    ivCtx,
    catalysts,
    userContext,
  });

  // ── Call Claude ───────────────────────────────────────────────────────
  let response;
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        { type: "text", text: PROMPT, cache_control: { type: "ephemeral" } },
        { type: "text", text: API_DIRECTIVE },
      ],
      messages: [{ role: "user", content: contextBlock }],
    });
  } catch (err) {
    console.error("[analyze] Anthropic error:", err.message);
    return res.status(500).json({
      error: "Dex couldn't reach the grading model. Try again in a moment.",
    });
  }

  const rawText = response.content[0]?.text || "";
  const parsed = parseDexGrade(rawText);
  if (!parsed) {
    console.warn("[analyze] Dex output didn't include parsable JSON block. Raw:", rawText.slice(0, 400));
    return res.status(500).json({
      error: "Dex returned an unparsable grade — please retry.",
    });
  }

  const cleanText = rawText.replace(/<DEX_GRADE>[\s\S]*?<\/DEX_GRADE>/, "").trim();
  const usage = response.usage || {};
  const cacheHit =
    typeof usage.cache_read_input_tokens === "number" && usage.cache_read_input_tokens > 0;

  // ── Log to Airtable ───────────────────────────────────────────────────
  const gradeRow = {
    email: normalizedEmail,
    ticker,
    timeframe,
    grade: parsed.grade,
    setup_type: parsed.setup_type,
    regime: parsed.regime,
    entry: parsed.entry,
    stop: parsed.stop_loss,
    tp1: parsed.tp1,
    tp2: parsed.tp2,
    tp3: parsed.tp3,
    r_multiple_planned: rMultiple(parsed.entry, parsed.stop_loss, parsed.tp1),
    iv_rank: ivCtx?.ivAtm ?? null,
    days_to_earnings: catalysts?.daysUntil ?? null,
    outcome: "open",
    prompt_version: PROMPT_VERSION,
    model_version: MODEL,
    why_this_works: parsed.why_this_works,
    risk_alert: parsed.risk_alert,
    raw_text: cleanText,
    created_at: new Date().toISOString(),
  };
  const gradeId = await airtable.logGrade(gradeRow);
  if (memberRec) {
    airtable.incrementMemberCounter(memberRec, "grades_requested", 1).catch(() => {});
  }

  return res.json({
    gradeId,
    grade: parsed.grade,
    riskReward: parsed.risk_reward,
    setupType: parsed.setup_type,
    regime: parsed.regime,
    entry: { price: parsed.entry, reason: parsed.entry_reason },
    stopLoss: { price: parsed.stop_loss, reason: parsed.stop_reason },
    takeProfits: [
      { price: parsed.tp1, reason: parsed.tp1_reason },
      { price: parsed.tp2, reason: parsed.tp2_reason },
      { price: parsed.tp3, reason: parsed.tp3_reason },
    ],
    whyThisWorks: parsed.why_this_works,
    whatYoureLearning: parsed.what_youre_learning,
    riskAlert: parsed.risk_alert,
    fullText: cleanText,
    meta: {
      price: quote.price,
      indicators: { rsi: rsiOut.current, macd: macdOut, atr: atrOut, ema20, ema50, ema200, boll },
      supportResistance: zones,
      ivContext: ivCtx,
      catalysts,
      promptVersion: PROMPT_VERSION,
      modelVersion: MODEL,
      cacheHit,
      usage,
    },
  });
};

// ──────────────────────────────────────────────────────────────────────────

function buildContextBlock({
  ticker,
  timeframe,
  quote,
  daily,
  candlesIntraday,
  indicators: ind,
  zones,
  ivCtx,
  catalysts,
  userContext,
}) {
  const recentDaily = daily.slice(-10).map(
    (c) => `${c.time.slice(0, 10)}  O:${c.open}  H:${c.high}  L:${c.low}  C:${c.close}  V:${c.volume}`
  );
  const recentIntraday = (candlesIntraday || []).slice(-8).map(
    (c) => `${c.time}  O:${c.open}  H:${c.high}  L:${c.low}  C:${c.close}  V:${c.volume}`
  );
  const zoneLines = zones.map(
    (z) => `  - ${z.role}: ${z.low}–${z.high}  vol≈${z.volume.toLocaleString()}`
  );

  return [
    `Grade the following setup on ${ticker} (${timeframe}).`,
    ``,
    `## Live quote`,
    `Last: ${quote.price}  PrevClose: ${quote.previousClose}  State: ${quote.marketState}`,
    `Day H/L: ${quote.dayHigh}/${quote.dayLow}  Vol: ${quote.volume}`,
    ``,
    `## Indicators (daily)`,
    `RSI(14): ${ind.rsi.current}   recent: ${ind.rsi.window.join(", ")}`,
    `MACD(12,26,9): ${ind.macd.macd} / sig ${ind.macd.signal} / hist ${ind.macd.histogram}  → ${ind.macd.posture}`,
    `ATR(14): ${ind.atr}`,
    `EMAs: 20=${ind.ema20}  50=${ind.ema50}  200=${ind.ema200}`,
    `Bollinger(20,2): upper ${ind.boll.upper}  mid ${ind.boll.middle}  lower ${ind.boll.lower}`,
    ``,
    `## Volume-at-price zones (top ${zones.length})`,
    ...(zoneLines.length ? zoneLines : ["  (none extracted)"]),
    ``,
    `## Recent daily bars`,
    ...recentDaily,
    ``,
    ...(recentIntraday.length
      ? [`## Recent intraday bars (${timeframe})`, ...recentIntraday, ``]
      : []),
    ...(ivCtx
      ? [
          `## Options context`,
          `ATM IV (${ivCtx.expiry}, ${ivCtx.daysToExpiry}d): ${ivCtx.ivAtm}`,
          ``,
        ]
      : []),
    ...(catalysts
      ? [
          `## Catalysts`,
          `Next earnings: ${catalysts.reportDate} (${catalysts.daysUntil}d away)${
            catalysts.daysUntil <= 7 ? "  ⚠ IV crush risk" : ""
          }`,
          ``,
        ]
      : []),
    ...(userContext
      ? [`## Trader's notes`, userContext, ``]
      : []),
  ].join("\n");
}

function parseDexGrade(rawText) {
  const m = rawText.match(/<DEX_GRADE>([\s\S]*?)<\/DEX_GRADE>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1].trim());
  } catch {
    return null;
  }
}

function rMultiple(entry, stop, tp1) {
  if (entry == null || stop == null || tp1 == null) return null;
  const risk = Math.abs(entry - stop);
  if (risk === 0) return null;
  return +((tp1 - entry) / (entry > stop ? risk : -risk)).toFixed(2);
}
