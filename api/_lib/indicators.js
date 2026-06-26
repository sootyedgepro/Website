// Indicator math. Wraps the `technicalindicators` npm package (validated 1:1
// against momentum_bot/indicators.py, which uses the Python `ta` library).
//
// All inputs are arrays of OHLCV candles like {open,high,low,close,volume}.
// All outputs are condensed to the latest reading + a short window so the
// LLM context block stays compact.

const ti = require("technicalindicators");

function lastN(arr, n) {
  return arr.slice(Math.max(0, arr.length - n));
}

function rsi(candles, period = 14) {
  const values = ti.RSI.calculate({
    values: candles.map((c) => c.close),
    period,
  });
  return {
    current: round2(values[values.length - 1]),
    window: lastN(values, 5).map(round2),
  };
}

function macd(candles, { fast = 12, slow = 26, signal = 9 } = {}) {
  const values = ti.MACD.calculate({
    values: candles.map((c) => c.close),
    fastPeriod: fast,
    slowPeriod: slow,
    signalPeriod: signal,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const latest = values[values.length - 1] || {};
  return {
    macd: round4(latest.MACD),
    signal: round4(latest.signal),
    histogram: round4(latest.histogram),
    posture:
      latest.MACD == null
        ? "unknown"
        : latest.MACD > latest.signal
        ? "bullish"
        : "bearish",
  };
}

function atr(candles, period = 14) {
  const values = ti.ATR.calculate({
    high: candles.map((c) => c.high),
    low: candles.map((c) => c.low),
    close: candles.map((c) => c.close),
    period,
  });
  return round4(values[values.length - 1]);
}

function ema(candles, period) {
  const values = ti.EMA.calculate({
    values: candles.map((c) => c.close),
    period,
  });
  return round2(values[values.length - 1]);
}

function bollinger(candles, { period = 20, stdDev = 2 } = {}) {
  const values = ti.BollingerBands.calculate({
    values: candles.map((c) => c.close),
    period,
    stdDev,
  });
  const latest = values[values.length - 1] || {};
  return {
    upper: round2(latest.upper),
    middle: round2(latest.middle),
    lower: round2(latest.lower),
  };
}

// Volume-at-price supply/resistance zones, ported from
// supply-squeeze-scanner/server/index.js:246-305.
function supportResistanceZones(candles, currentPrice, NUM_BUCKETS = 30) {
  if (!candles || candles.length === 0) return [];
  const priceMin = Math.min(...candles.map((c) => c.low));
  const priceMax = Math.max(...candles.map((c) => c.high));
  const bucketSize = (priceMax - priceMin) / NUM_BUCKETS;
  if (bucketSize === 0) return [];

  const volumeByBucket = new Array(NUM_BUCKETS).fill(0);
  for (const c of candles) {
    const loBucket = Math.min(
      NUM_BUCKETS - 1,
      Math.max(0, Math.floor((c.low - priceMin) / bucketSize))
    );
    const hiBucket = Math.min(
      NUM_BUCKETS - 1,
      Math.max(0, Math.floor((c.high - priceMin) / bucketSize))
    );
    const span = hiBucket - loBucket + 1;
    const perBucket = (c.volume || 0) / span;
    for (let b = loBucket; b <= hiBucket; b++) {
      volumeByBucket[b] += perBucket;
    }
  }

  const candidates = volumeByBucket
    .map((vol, b) => ({
      low: round2(priceMin + b * bucketSize),
      high: round2(priceMin + (b + 1) * bucketSize),
      volume: Math.round(vol),
    }))
    .filter((z) => z.volume > 0);

  const merged = [];
  for (const z of candidates) {
    const prev = merged[merged.length - 1];
    if (prev && Math.abs(prev.high - z.low) < 0.01) {
      prev.high = z.high;
      prev.volume += z.volume;
    } else {
      merged.push({ ...z });
    }
  }

  const top = merged
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8)
    .sort((a, b) => a.low - b.low);

  return top.map((z) => ({
    ...z,
    role: z.high < currentPrice ? "support" : "resistance",
  }));
}

// Rough IV rank vs a window of historical IV readings (caller supplies the
// history — Polygon's ATM-IV is point-in-time, so the caller is responsible
// for collecting/storing the trailing sample). Returns 0-100.
function ivRank(currentIV, history) {
  if (currentIV == null || !history?.length) return null;
  const lo = Math.min(...history);
  const hi = Math.max(...history);
  if (hi === lo) return null;
  return Math.round(((currentIV - lo) / (hi - lo)) * 100);
}

function round2(x) {
  return x == null || Number.isNaN(x) ? null : +Number(x).toFixed(2);
}
function round4(x) {
  return x == null || Number.isNaN(x) ? null : +Number(x).toFixed(4);
}

module.exports = {
  rsi,
  macd,
  atr,
  ema,
  bollinger,
  supportResistanceZones,
  ivRank,
};
