// Shared Airtable client for Dex. Reuses existing AIRTABLE_API_KEY and
// AIRTABLE_BASE_ID from .env (already used by api/chat/index.js).
//
// Tables (created in the Airtable UI before first use):
//   Members        - email, Membership Status, plan, joined_at, grades_requested
//   DexGrades      - one row per grade Dex emits (see schema below)
//   DexOutcomes    - one row per trade outcome the user reports back

const Airtable = require("airtable");

let baseInstance = null;
function base() {
  if (baseInstance) return baseInstance;
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    throw new Error("AIRTABLE_API_KEY and AIRTABLE_BASE_ID required");
  }
  baseInstance = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID
  );
  return baseInstance;
}

// Member lookup by email. Returns the Airtable record or null.
//
// Two layers of input safety on top of the Airtable filterByFormula string:
//   1. Strict RFC-ish format check before the value ever reaches the formula.
//   2. Backslash + double-quote escaping (in that order — backslash must go
//      first or the second pass re-breaks what the first wrote).
// Without (1) the previous code only escaped `"`, leaving `\` as a vector
// to break out of the string literal and rewrite the predicate.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function escapeFormulaString(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function findMember(email) {
  if (typeof email !== "string" || !EMAIL_RE.test(email)) return null;
  const safe = escapeFormulaString(email.trim().toLowerCase());
  try {
    const records = await base()("Members")
      .select({
        maxRecords: 1,
        filterByFormula: `LOWER({email}) = "${safe}"`,
      })
      .firstPage();
    return records[0] || null;
  } catch (err) {
    console.warn(`[airtable.findMember] ${err.message}`);
    return null;
  }
}

function isActiveMember(record) {
  if (!record) return false;
  const status = record.get("Membership Status");
  return typeof status === "string" && status.toLowerCase() === "active";
}

// Log a graded setup. Returns the created record's ID (used as trade_id) or null.
async function logGrade(row) {
  try {
    const [rec] = await base()("DexGrades").create([{ fields: row }]);
    return rec?.id || null;
  } catch (err) {
    console.warn(`[airtable.logGrade] ${err.message}`);
    return null;
  }
}

// Update a previously-logged grade with the trade outcome.
async function logOutcome(gradeRecordId, outcome) {
  try {
    await base()("DexGrades").update([{ id: gradeRecordId, fields: outcome }]);
    return true;
  } catch (err) {
    console.warn(`[airtable.logOutcome] ${err.message}`);
    return false;
  }
}

// Increment a per-member counter (best-effort; failures are silent).
async function incrementMemberCounter(memberRecord, field, by = 1) {
  if (!memberRecord) return;
  try {
    const current = Number(memberRecord.get(field) || 0);
    await base()("Members").update([
      { id: memberRecord.id, fields: { [field]: current + by } },
    ]);
  } catch (err) {
    console.warn(`[airtable.incrementMemberCounter] ${err.message}`);
  }
}

module.exports = {
  base,
  findMember,
  isActiveMember,
  logGrade,
  logOutcome,
  incrementMemberCounter,
};
