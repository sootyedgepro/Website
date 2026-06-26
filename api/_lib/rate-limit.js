// Two-layer rate limiter: per-IP floor + per-email ceiling.
// In-memory for v1 — each Vercel instance has its own buckets, so caps are
// approximate under concurrent load. Promote to Upstash Redis once paid
// traffic warrants it.
//
// The IP floor is the important layer for cost control: it bounds spend
// per source even when an attacker rotates fake emails through the API.

const { isValidEmail } = require("./cors");

const PER_MIN = Number(process.env.DEX_RATE_LIMIT_PER_MIN || 3);
const PER_DAY = Number(process.env.DEX_RATE_LIMIT_PER_DAY || 50);
const IP_PER_MIN = Number(process.env.DEX_IP_RATE_LIMIT_PER_MIN || 10);
const IP_PER_DAY = Number(process.env.DEX_IP_RATE_LIMIT_PER_DAY || 120);

const emailBuckets = new Map();
const ipBuckets = new Map();

function peekBucket(store, key, perMin, perDay, now) {
  const minCut = now - 60_000;
  const dayCut = now - 24 * 60 * 60_000;
  const bucket = store.get(key) || { minWindow: [], dayWindow: [] };
  bucket.minWindow = bucket.minWindow.filter((t) => t > minCut);
  bucket.dayWindow = bucket.dayWindow.filter((t) => t > dayCut);

  if (bucket.minWindow.length >= perMin) {
    return { allowed: false, reason: "rate_limit_minute", retryAfterSec: 60, bucket };
  }
  if (bucket.dayWindow.length >= perDay) {
    return {
      allowed: false,
      reason: "rate_limit_day",
      retryAfterSec: 24 * 60 * 60,
      bucket,
    };
  }
  return { allowed: true, bucket };
}

function check({ email, ip } = {}) {
  const now = Date.now();

  // IP floor — always applied when we have one. This is the layer that
  // protects against the wildcard-CORS-rotating-fake-emails attack.
  let ipResult = null;
  if (ip) {
    ipResult = peekBucket(ipBuckets, ip, IP_PER_MIN, IP_PER_DAY, now);
    if (!ipResult.allowed) {
      return { allowed: false, reason: ipResult.reason, retryAfterSec: ipResult.retryAfterSec };
    }
  }

  // Email layer — only honored for syntactically valid emails. An invalid
  // email contributes nothing to the bucket (and previously could be
  // anything truthy, so this is intentionally stricter than before).
  let emailResult = null;
  const normalized = isValidEmail(email) ? email.trim().toLowerCase() : null;
  if (normalized) {
    emailResult = peekBucket(emailBuckets, normalized, PER_MIN, PER_DAY, now);
    if (!emailResult.allowed) {
      return { allowed: false, reason: emailResult.reason, retryAfterSec: emailResult.retryAfterSec };
    }
  }

  // Both passed (or floor-only) — record on both windows.
  if (ipResult) {
    ipResult.bucket.minWindow.push(now);
    ipResult.bucket.dayWindow.push(now);
    ipBuckets.set(ip, ipResult.bucket);
  }
  if (emailResult) {
    emailResult.bucket.minWindow.push(now);
    emailResult.bucket.dayWindow.push(now);
    emailBuckets.set(normalized, emailResult.bucket);
  }

  return { allowed: true };
}

module.exports = { check, PER_MIN, PER_DAY, IP_PER_MIN, IP_PER_DAY };
