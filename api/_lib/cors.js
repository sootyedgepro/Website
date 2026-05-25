// Shared CORS allowlist for Dex / Analyze / Chat endpoints.
// Replaces the wildcard `Access-Control-Allow-Origin: *` that was on every
// AI-billing endpoint. Without this, any origin could call /api/dex/chat
// and burn Anthropic credits.

const STATIC_ORIGINS = new Set([
  "https://sootyedge.com",
  "https://www.sootyedge.com",
  "https://travelinginprofit.com",
  "https://www.travelinginprofit.com",
  "http://localhost:5173",
  "http://localhost:3000",
]);

const DEX_SUBDOMAIN_RE = /^https:\/\/dex\.[a-z0-9.-]+$/i;

function isAllowed(origin) {
  if (!origin) return false;
  if (STATIC_ORIGINS.has(origin)) return true;
  if (DEX_SUBDOMAIN_RE.test(origin)) return true;
  return false;
}

function applyCors(req, res, { methods = "POST,OPTIONS" } = {}) {
  const origin = req.headers.origin;
  if (isAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) {
    return fwd.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email) {
  return typeof email === "string" && EMAIL_RE.test(email);
}

module.exports = { applyCors, isAllowed, clientIp, isValidEmail, EMAIL_RE };
