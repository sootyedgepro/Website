// Polygon.io thin client — only the slices Dex needs.
// Direct REST via fetch (no SDK dep) to keep package surface small.
// Required env: POLYGON_API_KEY.
//
// Endpoints used:
//   /v3/reference/options/contracts          → options-chain expirations & strikes
//   /v3/snapshot/options/:underlyingAsset    → live IV / Greeks per contract
//   /vX/reference/financials                 → fundamentals (future use)
//   /v3/reference/tickers/:ticker            → ticker reference info
//   /v3/reference/dividends                  → not used yet
//   /v2/reference/news                       → news (future use)
//   /vX/reference/earnings                   → earnings calendar (beta)
//
// All calls cache per-process for 60s (OHLCV) or 6h (earnings/news) to stay
// under Polygon Starter's 5 req/min ceiling.

const BASE = "https://api.polygon.io";
const API_KEY = process.env.POLYGON_API_KEY;
const ENABLED = Boolean(API_KEY);

const cache = new Map();

function cacheGet(key, ttlMs) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  cache.set(key, { value, at: Date.now() });
}

async function polygonGet(pathname, params = {}, { ttlMs = 60_000 } = {}) {
  if (!ENABLED) {
    return { __disabled: true, reason: "POLYGON_API_KEY not configured" };
  }
  const url = new URL(BASE + pathname);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v));
  }
  url.searchParams.set("apiKey", API_KEY);

  const cacheKey = url.toString().replace(API_KEY, "<key>");
  const cached = cacheGet(cacheKey, ttlMs);
  if (cached) return cached;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(url.toString(), { signal: ctrl.signal });
    if (!res.ok) {
      throw new Error(`Polygon ${pathname}: HTTP ${res.status}`);
    }
    const data = await res.json();
    cacheSet(cacheKey, data);
    return data;
  } finally {
    clearTimeout(t);
  }
}

// At-the-money implied volatility for the nearest standard-monthly expiry.
// Returns { ivAtm, expiry, daysToExpiry } or null when options not active.
async function getATMIV(ticker, spotPrice) {
  if (!ENABLED) return null;
  try {
    const snap = await polygonGet(`/v3/snapshot/options/${encodeURIComponent(ticker)}`, {
      limit: 250,
    });
    const contracts = snap?.results || [];
    if (!contracts.length) return null;

    // Pick the nearest expiry with both calls + puts.
    const byExpiry = {};
    for (const c of contracts) {
      const exp = c?.details?.expiration_date;
      if (!exp) continue;
      (byExpiry[exp] ||= []).push(c);
    }
    const today = new Date().toISOString().slice(0, 10);
    const sortedExpiries = Object.keys(byExpiry)
      .filter((e) => e >= today)
      .sort();
    if (!sortedExpiries.length) return null;
    const expiry = sortedExpiries[0];

    // Find ATM contract (strike closest to spot) among calls in that expiry.
    const calls = byExpiry[expiry].filter((c) => c?.details?.contract_type === "call");
    if (!calls.length) return null;
    calls.sort(
      (a, b) =>
        Math.abs((a.details.strike_price ?? 0) - spotPrice) -
        Math.abs((b.details.strike_price ?? 0) - spotPrice)
    );
    const atm = calls[0];
    const ivAtm = atm?.implied_volatility ?? null;
    if (ivAtm == null) return null;

    const dte = Math.max(
      0,
      Math.round((new Date(expiry).getTime() - Date.now()) / 86_400_000)
    );
    return { ivAtm: +Number(ivAtm).toFixed(4), expiry, daysToExpiry: dte };
  } catch (err) {
    console.warn(`[polygon.getATMIV] ${ticker}: ${err.message}`);
    return null;
  }
}

// Next earnings date. Polygon's earnings endpoint is in beta; null on failure
// is fine — Dex will simply skip the IV-crush flag.
async function getEarningsCalendar(ticker) {
  if (!ENABLED) return null;
  try {
    const data = await polygonGet(
      `/vX/reference/earnings`,
      { ticker, limit: 5, order: "asc" },
      { ttlMs: 6 * 60 * 60 * 1000 }
    );
    const upcoming = (data?.results || []).find((r) => {
      const dt = r?.report_date || r?.fiscal_period_end;
      return dt && dt >= new Date().toISOString().slice(0, 10);
    });
    if (!upcoming) return null;
    const reportDate = upcoming.report_date || upcoming.fiscal_period_end;
    const daysUntil = Math.max(
      0,
      Math.round((new Date(reportDate).getTime() - Date.now()) / 86_400_000)
    );
    return { reportDate, daysUntil };
  } catch (err) {
    console.warn(`[polygon.getEarningsCalendar] ${ticker}: ${err.message}`);
    return null;
  }
}

module.exports = { getATMIV, getEarningsCalendar, ENABLED };
