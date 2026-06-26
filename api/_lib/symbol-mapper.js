// Map TradingView-style and trader-shorthand symbols into the Yahoo Finance
// symbol format. Yahoo uses ^ for indices, =X for forex, =F for futures,
// and -USD for crypto. Most traders type the TV symbol (NAS100, XAUUSD, BTC)
// — this layer lets them grade what they're already watching.

const SYMBOL_MAP = {
  // ── Indices ─────────────────────────────────────────
  NAS100: "^NDX",
  NDX: "^NDX",
  NDQ: "^NDX",
  NASDAQ: "^NDX",
  US100: "^NDX",

  SPX500: "^GSPC",
  SPX: "^GSPC",
  SP500: "^GSPC",
  US500: "^GSPC",

  US30: "^DJI",
  DJI: "^DJI",
  DOW: "^DJI",
  DJIA: "^DJI",

  RUSSELL: "^RUT",
  RUT: "^RUT",
  US2000: "^RUT",

  UK100: "^FTSE",
  FTSE: "^FTSE",
  FTSE100: "^FTSE",

  GER40: "^GDAXI",
  DAX: "^GDAXI",
  DE40: "^GDAXI",

  JPN225: "^N225",
  NIKKEI: "^N225",
  N225: "^N225",

  AUS200: "^AXJO",
  HK50: "^HSI",
  HSI: "^HSI",

  VIX: "^VIX",
  DXY: "DX-Y.NYB",

  // ── Commodities (use Yahoo futures contracts) ───────
  XAUUSD: "GC=F",
  GOLD: "GC=F",
  GC: "GC=F",

  XAGUSD: "SI=F",
  SILVER: "SI=F",
  SI: "SI=F",

  XPTUSD: "PL=F",
  PLATINUM: "PL=F",

  XPDUSD: "PA=F",
  PALLADIUM: "PA=F",

  OIL: "CL=F",
  USOIL: "CL=F",
  WTI: "CL=F",
  CRUDE: "CL=F",
  UKOIL: "BZ=F",
  BRENT: "BZ=F",

  NATGAS: "NG=F",
  NGAS: "NG=F",

  COPPER: "HG=F",

  // ── Crypto ──────────────────────────────────────────
  BTC: "BTC-USD",
  BITCOIN: "BTC-USD",
  BTCUSD: "BTC-USD",
  BTCUSDT: "BTC-USD",

  ETH: "ETH-USD",
  ETHEREUM: "ETH-USD",
  ETHUSD: "ETH-USD",
  ETHUSDT: "ETH-USD",

  SOL: "SOL-USD",
  SOLUSD: "SOL-USD",

  XRP: "XRP-USD",
  XRPUSD: "XRP-USD",

  DOGE: "DOGE-USD",
  DOGEUSD: "DOGE-USD",
};

// 6-letter forex pair like EURUSD, GBPJPY, etc.
const FOREX_PAIR_RE = /^([A-Z]{3})([A-Z]{3})$/;
const CCY = new Set([
  "USD", "EUR", "GBP", "JPY", "CHF", "AUD", "NZD", "CAD",
  "CNY", "HKD", "SGD", "SEK", "NOK", "DKK", "ZAR", "MXN",
  "BRL", "INR", "TRY", "KRW", "TWD", "PLN", "HUF", "CZK",
  "ILS", "RUB",
]);

function mapSymbol(input) {
  const sym = (input || "").trim().toUpperCase();
  if (!sym) return sym;

  if (SYMBOL_MAP[sym]) return SYMBOL_MAP[sym];

  // Auto-detect forex pairs: XXXYYY where both halves are real currencies.
  const m = sym.match(FOREX_PAIR_RE);
  if (m && CCY.has(m[1]) && CCY.has(m[2])) {
    return `${sym}=X`;
  }

  // Already-Yahoo-formatted inputs pass through (e.g. "BTC-USD", "^NDX", "GC=F").
  return sym;
}

module.exports = { mapSymbol };
