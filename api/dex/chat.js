// POST /api/dex/chat
// Multi-turn conversation with Dex (Claude Sonnet 4.6) using tool-use.
// Dex chats freely; when the user asks about a setup or names a ticker,
// Dex calls the `fetch_market_data` tool to pull live OHLCV + indicators +
// IV/earnings, then grades inside the conversation per the canonical format.
//
// Body: { sessionId?: string, message: string, email?: string }
// Returns: { sessionId, message, grade?, gradeId? }

const Anthropic = require("@anthropic-ai/sdk");
const { v4: uuidv4 } = require("uuid");
const { PROMPT, PROMPT_VERSION } = require("../_lib/dex-prompt");
const { fetchYahooOHLCV, fetchYahooQuote } = require("../_lib/yahoo");
const { getATMIV, getEarningsCalendar, ENABLED: POLYGON_ON } = require("../_lib/polygon");
const indicators = require("../_lib/indicators");
const airtable = require("../_lib/airtable");
const rateLimit = require("../_lib/rate-limit");
const { applyCors, clientIp, isValidEmail } = require("../_lib/cors");

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2800;
const MAX_SESSION_TURNS = 40;
const SESSION_TTL_MS = 60 * 60 * 1000;

const sessions = new Map();

const CHAT_DIRECTIVE = `You are Dex in a live chat with a SootyEdge trader. Chat naturally and conversationally for greetings and follow-ups (one warm question, not a wall of text).

BUT: when you actually grade a setup, GO DEEP. The grade is the product. Each reasoning field must be specific, numerical, and educational, not generic.

Tool use:
When the user names a ticker (e.g. "grade AAPL", "what about NVDA on the 1h", "I'm watching TSLA"), call the fetch_market_data tool with that ticker + timeframe (default "1d" if unspecified) BEFORE you grade. Do not invent prices.

After the tool returns, REASON IN THE SOOTYEDGE FRAMEWORK. The tool returns a sootyEdge block that mirrors the live SootyEdge Pine indicators (Action Zones v6, Sooty Flow Tracker Pro, Dot v6) recreated from OHLCV. Use these names in every grade:

- sootyEdge.actionZones.strongResist / sellZone / retestAbove / retestBelow / buyZone / strongSupport — cite the specific price bands from these in your level reasoning. Each has a band [low, high] and a distance % from current price.
- sootyEdge.flowScore.score (0-100) and .action ("FIRE" / "PREPARE" / "STAND DOWN" / "AVOID") and .bias — this IS the Flow Tracker SCORE. A grade only earns A or B if the score "fires" (>=50) and the bias agrees with the trade direction. C and below if the score is in PREPARE or below.
- sootyEdge.sootyFlow.support / .resistance — these ARE the "Sooty Flow Support" and "Sooty Flow Resistance" lines. Your Stop level should anchor to Sooty Flow Support (long setups) or Sooty Flow Resistance (short setups).

Speak the SootyEdge dialect: "Sell Zone band at X-Y", "Strong Resist at X", "Sooty Flow Support at X is the line in the sand", "Flow Tracker SCORE is 40/50 — PREPARE not FIRE", "Buy Zone at X-Y where demand statistically reloads". You can still mention RSI, MACD, EMAs (they're in indicators.*) when relevant, but FRAME them through SootyEdge concepts. Specific numerical citations from the actionZones bands and flowScore are mandatory in Why This Works and Risk Alert.

Grade output format:
First, write a brief 1-3 sentence conversational lead-in ("Alright, got the tape. Here's what I'm seeing.") that mentions one or two of the most relevant indicator readings.

Then output the canonical structured grade:

Grade: [Letter] | Risk-Reward: [Ratio]
Setup Type: [breakout | pullback | reversal | range | momentum | mean-reversion]
Regime: [trending | chop | volatile | quiet]

Entry: [Price]. [2 sentences. The price level itself, the indicator/zone confluence behind it, and any confirmation trigger required before pulling the trigger.]
Stop Loss: [Price]. [2 sentences. What this level represents structurally, and what it tells you about thesis invalidation.]
TP1: [Price]. [2 sentences. Where this target sits in the structure (resistance, EMA, prior high, supply zone), percent gain from entry, and what to do here (partial, full, scale).]
TP2: [Price]. [2 sentences. Same depth as TP1.]
TP3: [Price]. [2 sentences. Same depth as TP1.]

Why This Works: [3-4 sentences. The full thesis with specific indicator numbers from the tool output (RSI X, MACD posture, EMA stack, ATR, key zones cited by price). Why these levels make sense together. The catalyst or context that makes this setup work right now.]

What You're Learning: [2-3 sentences. ONE specific trading skill (support/resistance, risk-reward, confluence, IV crush, etc.) with a concrete takeaway the trader can apply on their next chart.]

Risk Alert: [3-4 sentences or a numbered list of 2-3 invalidation triggers. What kills this trade fast, and what to watch for as early-warning signals. Cite specific levels and indicators.]

This grade is educational analysis, not investment advice. Trade your own risk.

After all that, append a JSON block on its own line for the UI:

<DEX_GRADE>{"grade":"A|B|C|D|F","risk_reward":"1:3","setup_type":"breakout","regime":"trending","entry":<num>,"entry_reason":"...","stop_loss":<num>,"stop_reason":"...","tp1":<num>,"tp1_reason":"...","tp2":<num>,"tp2_reason":"...","tp3":<num>,"tp3_reason":"...","why_this_works":"...","what_youre_learning":"...","risk_alert":"...","ticker":"AAPL","timeframe":"1d"}</DEX_GRADE>

The JSON's reasoning fields should be the same content as the human-readable ones above (don't dumb them down for JSON).

For non-grading turns (follow-ups, clarifying questions, education), no JSON. Just chat naturally.`;

const TOOLS = [
  {
    name: "fetch_market_data",
    description:
      "Fetch live OHLCV bars, standard technicals (RSI, MACD, ATR, EMAs, Bollinger), and the SootyEdge framework (Action Zones: Strong Resist, Sell Zone, Buy Zone, Strong Support, Retest levels; Flow Tracker SCORE 0-100 with action verdict FIRE/PREPARE/STAND DOWN/AVOID; Sooty Flow support/resistance lines). Also returns options ATM IV and earnings calendar for equities. Call BEFORE grading. Reason in SootyEdge terminology using the returned actionZones / flowScore / sootyFlow.",
    input_schema: {
      type: "object",
      properties: {
        ticker: {
          type: "string",
          description:
            "Symbol the trader is watching. Accepts TradingView-style names: stocks (AAPL, TSLA, NVDA), indices (NAS100, US30, SPX500, DXY, VIX, GER40, JPN225), forex pairs (EURUSD, GBPJPY, AUDCAD), commodities (XAUUSD/GOLD, XAGUSD/SILVER, OIL/WTI, NATGAS, COPPER), crypto (BTC, ETH, SOL, XRP). Symbol normalization to the underlying data source is automatic.",
        },
        timeframe: {
          type: "string",
          enum: ["1d", "1h", "15m", "5m"],
          description: "Bar timeframe. Defaults to 1d if unspecified.",
        },
      },
      required: ["ticker"],
    },
  },
];

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  const { sessionId: clientSessionId, message, email } = req.body || {};
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message required" });
  }
  const trimmed = message.trim();
  if (trimmed.length > 2000) {
    return res.status(400).json({ error: "message too long (max 2000 chars)" });
  }

  // Rate limit: IP floor (always) + per-email ceiling (when email is valid).
  // The IP floor is what stops attackers from rotating fake emails to dodge
  // the per-email cap and drain the Anthropic budget.
  const ip = clientIp(req);
  const normalizedEmail = isValidEmail(email) ? email.trim().toLowerCase() : null;
  const rl = rateLimit.check({ email: normalizedEmail, ip });
  if (!rl.allowed) {
    res.setHeader("Retry-After", String(rl.retryAfterSec));
    return res.status(429).json({
      error:
        rl.reason === "rate_limit_minute"
          ? "Easy — give it a beat. Try again in a minute."
          : "Daily Dex limit hit. Back tomorrow.",
      retryAfterSec: rl.retryAfterSec,
    });
  }

  const sessionId = clientSessionId || uuidv4();
  pruneStaleSessions();
  const session = getOrCreateSession(sessionId);
  session.lastSeen = Date.now();
  if (normalizedEmail) session.email = normalizedEmail;

  session.messages.push({ role: "user", content: trimmed });
  capToMaxTurns(session);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let finalText = "";
  let extractedGrade = null;
  let latestChartData = null;
  let hops = 0;
  const MAX_TOOL_HOPS = 4;

  try {
    while (hops < MAX_TOOL_HOPS) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          { type: "text", text: PROMPT, cache_control: { type: "ephemeral" } },
          { type: "text", text: CHAT_DIRECTIVE },
        ],
        tools: TOOLS,
        messages: session.messages,
      });

      if (response.stop_reason === "tool_use") {
        session.messages.push({ role: "assistant", content: response.content });
        const toolResults = [];
        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          if (block.name === "fetch_market_data") {
            const result = await runFetchMarketData(block.input || {});
            if (result && !result.error && result.chartBars?.length) {
              latestChartData = {
                ticker: result.ticker,
                timeframe: result.timeframe,
                bars: result.chartBars,
                quote: result.quote,
              };
            }
            // Send the LLM a slimmer version (no big bars array — saves tokens).
            const { chartBars: _omit, ...llmResult } = result || {};
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(llmResult),
            });
          } else {
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify({ error: `unknown tool: ${block.name}` }),
              is_error: true,
            });
          }
        }
        session.messages.push({ role: "user", content: toolResults });
        hops++;
        continue;
      }

      // No more tools — collect the final text and stop.
      const textBlocks = response.content.filter((b) => b.type === "text");
      finalText = textBlocks.map((b) => b.text).join("\n").trim();
      session.messages.push({ role: "assistant", content: response.content });
      break;
    }
  } catch (err) {
    console.error("[dex/chat] Anthropic error:", err.message);
    return res.status(500).json({
      error: "Dex hit a problem on the model side. Try again.",
    });
  }

  // Parse + strip the <DEX_GRADE> block (if present) so the user-facing
  // text is purely conversational; the structured grade rides alongside.
  // Hard-strip em-dashes/en-dashes — belt + suspenders on the prompt rule.
  const { cleanText: rawClean, grade } = parseGrade(finalText);
  const cleanText = stripDashes(rawClean);
  extractedGrade = grade ? stripDashesDeep(grade) : null;
  if (extractedGrade && latestChartData) {
    extractedGrade.chart = latestChartData;
  }

  // Best-effort Airtable log for graded turns.
  let gradeId = null;
  if (extractedGrade) {
    try {
      gradeId = await airtable.logGrade({
        email: email || session.email || "",
        ticker: extractedGrade.ticker,
        timeframe: extractedGrade.timeframe || "1d",
        grade: extractedGrade.grade,
        setup_type: extractedGrade.setup_type,
        regime: extractedGrade.regime,
        entry: extractedGrade.entry,
        stop: extractedGrade.stop_loss,
        tp1: extractedGrade.tp1,
        tp2: extractedGrade.tp2,
        tp3: extractedGrade.tp3,
        r_multiple_planned: rMultiple(
          extractedGrade.entry,
          extractedGrade.stop_loss,
          extractedGrade.tp1
        ),
        outcome: "open",
        prompt_version: PROMPT_VERSION,
        model_version: MODEL,
        why_this_works: extractedGrade.why_this_works,
        risk_alert: extractedGrade.risk_alert,
        raw_text: cleanText,
        source: "chat",
        session_id: sessionId,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("[dex/chat] grade log failed:", err.message);
    }
  }

  return res.json({
    sessionId,
    message: cleanText,
    grade: extractedGrade
      ? {
          ...extractedGrade,
          gradeId,
        }
      : null,
  });
};

// ── Tool runner ────────────────────────────────────────────────────────────
async function runFetchMarketData({ ticker, timeframe = "1d" }) {
  if (typeof ticker !== "string" || !ticker.trim()) {
    return { error: "ticker required" };
  }
  const sym = ticker.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(sym)) {
    return { error: `invalid ticker: ${sym}` };
  }

  let dailyRes, intradayRes, quote;
  try {
    [dailyRes, quote] = await Promise.all([
      fetchYahooOHLCV(sym, { interval: "1d", range: "1y" }),
      fetchYahooQuote(sym),
    ]);
    if (timeframe !== "1d") {
      try {
        intradayRes = await fetchYahooOHLCV(sym, {
          interval: timeframe,
          range: timeframe === "1h" ? "1mo" : "5d",
        });
      } catch (err) {
        // intraday is bonus — don't fail the whole call
      }
    }
  } catch (err) {
    return { error: `couldn't fetch market data: ${err.message}` };
  }

  const daily = dailyRes.candles;
  if (!daily || daily.length < 30) {
    return { error: `not enough OHLCV history for ${sym}` };
  }

  const rsiOut = indicators.rsi(daily);
  const macdOut = indicators.macd(daily);
  const atrOut = indicators.atr(daily);
  const ema20 = indicators.ema(daily, 20);
  const ema50 = indicators.ema(daily, 50);
  const ema200 = indicators.ema(daily, 200);
  const boll = indicators.bollinger(daily);
  const zones = indicators.supportResistanceZones(daily, quote.price);

  // SootyEdge-style derived framework (mirrors the live Pine indicators when
  // the user is running them on TradingView — recreated from OHLCV here).
  const actionZones = labelActionZones(zones, quote.price);
  const flowScore = computeFlowScore({
    rsi: rsiOut.current,
    macd: macdOut,
    ema20, ema50, ema200,
    price: quote.price,
  });
  const sootyFlow = labelSootyFlow({
    price: quote.price,
    ema20,
    ema50,
    actionZones,
  });

  let ivCtx = null;
  let catalysts = null;
  if (POLYGON_ON) {
    [ivCtx, catalysts] = await Promise.all([
      getATMIV(sym, quote.price),
      getEarningsCalendar(sym),
    ]);
  }

  const recentBars = daily.slice(-10).map((c) => ({
    date: c.time.slice(0, 10),
    o: c.open,
    h: c.high,
    l: c.low,
    c: c.close,
    v: c.volume,
  }));
  const recentIntraday = (intradayRes?.candles || []).slice(-8).map((c) => ({
    time: c.time,
    o: c.open,
    h: c.high,
    l: c.low,
    c: c.close,
    v: c.volume,
  }));

  // Full bar set for the frontend chart. NOT included in the LLM tool result
  // (the caller strips chartBars before serializing to Claude to keep tokens low).
  const chartBars = daily.slice(-90).map((c) => ({
    time: c.time.slice(0, 10),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));

  return {
    ticker: sym,
    timeframe,
    quote: {
      price: quote.price,
      previousClose: quote.previousClose,
      marketState: quote.marketState,
      dayHigh: quote.dayHigh,
      dayLow: quote.dayLow,
      volume: quote.volume,
    },
    indicators: {
      rsi: rsiOut.current,
      rsi_recent: rsiOut.window,
      macd: macdOut,
      atr: atrOut,
      ema20,
      ema50,
      ema200,
      bollinger: boll,
    },
    sootyEdge: {
      actionZones,
      flowScore,
      sootyFlow,
    },
    supportResistance: zones,
    recentBars,
    recentIntraday,
    chartBars,
    ivContext: ivCtx,
    catalysts,
  };
}

// ── SootyEdge framework helpers ─────────────────────────────────────────
// Recreate the SootyEdge Pine indicator output (Action Zones, Flow Tracker
// SCORE, Sooty Flow support/resistance) from Yahoo OHLCV. When the user has
// the live Pine scripts running on TradingView the values agree; when they
// don't, this gives Dex the same vocabulary to reason with.

function labelActionZones(zones, price) {
  if (!Array.isArray(zones) || zones.length === 0) return null;
  const above = zones
    .filter((z) => z.low > price)
    .sort((a, b) => a.low - b.low);
  const below = zones
    .filter((z) => z.high < price)
    .sort((a, b) => b.high - a.high);

  const heaviest = (arr) =>
    arr.length ? [...arr].sort((a, b) => b.volume - a.volume)[0] : null;

  const strongResist = heaviest(above);
  const strongSupport = heaviest(below);

  // Sell Zone = the supply band just below Strong Resist (next-nearest above).
  // Buy Zone = the demand band just above Strong Support (next-nearest below).
  const sellZone = above.find((z) => z !== strongResist) || strongResist;
  const buyZone = below.find((z) => z !== strongSupport) || strongSupport;

  return {
    strongResist: strongResist
      ? { label: "Strong Resist", band: [strongResist.low, strongResist.high], distance: +(((strongResist.low - price) / price) * 100).toFixed(2) }
      : null,
    sellZone: sellZone
      ? { label: "Sell Zone", band: [sellZone.low, sellZone.high], distance: +(((sellZone.low - price) / price) * 100).toFixed(2) }
      : null,
    retestAbove: above[0]
      ? { label: "Retest Above", price: above[0].low, distance: +(((above[0].low - price) / price) * 100).toFixed(2) }
      : null,
    retestBelow: below[0]
      ? { label: "Retest Below", price: below[0].high, distance: +(((price - below[0].high) / price) * 100).toFixed(2) }
      : null,
    buyZone: buyZone
      ? { label: "Buy Zone", band: [buyZone.low, buyZone.high], distance: +(((price - buyZone.high) / price) * 100).toFixed(2) }
      : null,
    strongSupport: strongSupport
      ? { label: "Strong Support", band: [strongSupport.low, strongSupport.high], distance: +(((price - strongSupport.high) / price) * 100).toFixed(2) }
      : null,
  };
}

// SCORE 0-100: 50+ "fires" the setup. Synthesized from EMA stack alignment,
// RSI posture, and MACD direction. Mirrors how the live SootyEdge Flow Tracker
// composes its bias verdict.
function computeFlowScore({ rsi, macd, ema20, ema50, ema200, price }) {
  let score = 50; // neutral starting line
  let bias = "neutral";
  const reasons = [];

  // EMA stack — heaviest weight (±25)
  if (ema20 != null && ema50 != null && ema200 != null) {
    if (ema20 > ema50 && ema50 > ema200) {
      score += 25;
      bias = "bullish";
      reasons.push("EMA stack bullish (20>50>200)");
      if (price > ema20) {
        score += 5;
        reasons.push("price above EMA20");
      }
    } else if (ema20 < ema50 && ema50 < ema200) {
      score -= 25;
      bias = "bearish";
      reasons.push("EMA stack bearish (20<50<200)");
      if (price < ema20) {
        score -= 5;
        reasons.push("price below EMA20");
      }
    } else {
      reasons.push("EMA stack mixed (chop)");
    }
  }

  // MACD posture (±15)
  if (macd && macd.posture) {
    if (macd.posture === "bullish") {
      score += 15;
      reasons.push("MACD bullish");
    } else if (macd.posture === "bearish") {
      score -= 15;
      reasons.push("MACD bearish");
    }
  }

  // RSI posture (±10)
  if (rsi != null) {
    if (rsi >= 50 && rsi <= 70) {
      score += 10;
      reasons.push(`RSI healthy bull (${rsi})`);
    } else if (rsi > 70) {
      score -= 5;
      reasons.push(`RSI overbought (${rsi})`);
    } else if (rsi >= 30 && rsi <= 50) {
      score -= 10;
      reasons.push(`RSI weak (${rsi})`);
    } else if (rsi < 30) {
      score += 5;
      reasons.push(`RSI oversold reversal candidate (${rsi})`);
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const action =
    score >= 70 ? "FIRE"
    : score >= 50 ? "PREPARE"
    : score >= 30 ? "STAND DOWN"
    : "AVOID";

  return {
    score,
    bias,
    action,
    fires: score >= 50,
    reasons,
  };
}

// "Sooty Flow Support" / "Sooty Flow Resistance" are the immediate structural
// lines the trader watches for thesis invalidation. We pick:
//   - Support = max(EMA20 if price above it, Buy Zone top, Retest Below)
//   - Resistance = min(EMA20 if price below it, Sell Zone bottom, Retest Above)
function labelSootyFlow({ price, ema20, ema50, actionZones }) {
  const supportCandidates = [];
  const resistanceCandidates = [];

  if (ema20 != null) {
    if (price > ema20) supportCandidates.push(ema20);
    else resistanceCandidates.push(ema20);
  }
  if (ema50 != null) {
    if (price > ema50) supportCandidates.push(ema50);
    else resistanceCandidates.push(ema50);
  }
  if (actionZones?.buyZone) supportCandidates.push(actionZones.buyZone.band[1]);
  if (actionZones?.retestBelow) supportCandidates.push(actionZones.retestBelow.price);
  if (actionZones?.sellZone) resistanceCandidates.push(actionZones.sellZone.band[0]);
  if (actionZones?.retestAbove) resistanceCandidates.push(actionZones.retestAbove.price);

  const support = supportCandidates.length ? Math.max(...supportCandidates) : null;
  const resistance = resistanceCandidates.length ? Math.min(...resistanceCandidates) : null;

  return { support, resistance };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      messages: [],
      email: null,
      lastSeen: Date.now(),
    });
  }
  return sessions.get(sessionId);
}

function pruneStaleSessions() {
  const cut = Date.now() - SESSION_TTL_MS;
  for (const [id, s] of sessions.entries()) {
    if (s.lastSeen < cut) sessions.delete(id);
  }
}

function capToMaxTurns(session) {
  if (session.messages.length > MAX_SESSION_TURNS * 4) {
    // Drop the oldest user/assistant pairs, keep the most recent ones.
    session.messages = session.messages.slice(-MAX_SESSION_TURNS * 4);
  }
}

function parseGrade(text) {
  const m = text.match(/<DEX_GRADE>([\s\S]*?)<\/DEX_GRADE>/);
  if (!m) return { cleanText: text, grade: null };
  let parsed = null;
  try {
    parsed = JSON.parse(m[1].trim());
  } catch {
    return { cleanText: text, grade: null };
  }
  const cleanText = text.replace(/<DEX_GRADE>[\s\S]*?<\/DEX_GRADE>/, "").trim();
  return { cleanText, grade: parsed };
}

// Replace em-dash and en-dash with comma+space (most natural in Dex's prose).
// Drops a leading "— " at the start of a sentence to just nothing.
function stripDashes(s) {
  if (typeof s !== "string") return s;
  return s
    .replace(/\s*[—–]\s+/g, ". ")
    .replace(/[—–]/g, ",");
}

function stripDashesDeep(obj) {
  if (typeof obj === "string") return stripDashes(obj);
  if (Array.isArray(obj)) return obj.map(stripDashesDeep);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = stripDashesDeep(v);
    return out;
  }
  return obj;
}

function rMultiple(entry, stop, tp1) {
  if (entry == null || stop == null || tp1 == null) return null;
  const risk = Math.abs(entry - stop);
  if (risk === 0) return null;
  return +((tp1 - entry) / (entry > stop ? risk : -risk)).toFixed(2);
}
