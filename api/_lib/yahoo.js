// Yahoo Finance OHLCV + quote. Free, no API key required.
// Ported from /Users/zillionaire/Cluade:Turbo/supply-squeeze-scanner/server/index.js (~lines 194-239),
// converted from axios to native fetch (Node 18+ on Vercel).
// Symbol normalization (NAS100 → ^NDX, XAUUSD → GC=F, EURUSD → EURUSD=X, etc.)
// is handled by ./symbol-mapper.

const { mapSymbol } = require("./symbol-mapper");

const UA = "Mozilla/5.0";
const HISTORY_TIMEOUT_MS = 10_000;
const QUOTE_TIMEOUT_MS = 6_000;

async function fetchWithTimeout(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// Daily/weekly/intraday candles. range examples: "1y", "6mo", "3mo", "1mo", "5d".
// interval examples: "1d", "1h", "15m", "5m".
async function fetchYahooOHLCV(ticker, { interval = "1d", range = "1y" } = {}) {
  const yahooSym = mapSymbol(ticker);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSym
  )}?interval=${interval}&range=${range}`;

  const data = await fetchWithTimeout(url, HISTORY_TIMEOUT_MS);
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo: no chart result for ${ticker}`);

  const ts = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const meta = result.meta || {};

  const candles = ts
    .map((t, i) => ({
      time: new Date(t * 1000).toISOString(),
      open: round2(q.open?.[i]),
      high: round2(q.high?.[i]),
      low: round2(q.low?.[i]),
      close: round2(q.close?.[i]),
      volume: q.volume?.[i] ?? 0,
    }))
    .filter((c) => c.open != null && c.high != null && c.low != null && c.close != null);

  return { candles, meta };
}

// Minimal live-quote fetch.
async function fetchYahooQuote(ticker) {
  const yahooSym = mapSymbol(ticker);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSym
  )}?interval=1m&range=1d`;
  const data = await fetchWithTimeout(url, QUOTE_TIMEOUT_MS);
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) throw new Error(`Yahoo: no quote for ${ticker}`);
  return {
    price: round2(meta.regularMarketPrice),
    previousClose: round2(meta.chartPreviousClose),
    marketState: meta.marketState || null,
    dayHigh: round2(meta.regularMarketDayHigh),
    dayLow: round2(meta.regularMarketDayLow),
    volume: meta.regularMarketVolume ?? null,
  };
}

function round2(x) {
  return x == null ? null : +Number(x).toFixed(2);
}

module.exports = { fetchYahooOHLCV, fetchYahooQuote };
