// POST /api/analyze/track-outcome
// User reports how the trade actually played out — the data that powers the
// feedback loop ("win-rate by grade × setup_type × regime"). Updates the
// DexGrades row in place.
//
// Body: { gradeId: string, email: string,
//         outcome: "tp1"|"tp2"|"tp3"|"stopped"|"manual_exit"|"expired",
//         outcomePrice?: number, entry?: number, stop?: number,
//         notes?: string }

const airtable = require("../_lib/airtable");

const VALID_OUTCOMES = new Set(["tp1", "tp2", "tp3", "stopped", "manual_exit", "expired"]);

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  const { gradeId, email, outcome, outcomePrice, entry, stop, notes } = req.body || {};

  if (!gradeId || typeof gradeId !== "string") {
    return res.status(400).json({ error: "gradeId required" });
  }
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "email required" });
  }
  if (!VALID_OUTCOMES.has(outcome)) {
    return res
      .status(400)
      .json({ error: `outcome must be one of: ${[...VALID_OUTCOMES].join(", ")}` });
  }

  // Compute realised R if we have enough numbers.
  let realisedR = null;
  if (
    typeof entry === "number" &&
    typeof stop === "number" &&
    typeof outcomePrice === "number" &&
    entry !== stop
  ) {
    const risk = Math.abs(entry - stop);
    const direction = entry > stop ? 1 : -1;
    realisedR = +(((outcomePrice - entry) * direction) / risk).toFixed(2);
  }

  const ok = await airtable.logOutcome(gradeId, {
    outcome,
    outcome_price: typeof outcomePrice === "number" ? outcomePrice : null,
    outcome_r_multiple: realisedR,
    closed_at: new Date().toISOString(),
    user_outcome_email: email,
    user_outcome_notes: typeof notes === "string" ? notes.slice(0, 2000) : "",
  });

  if (!ok) {
    return res.status(500).json({ error: "Couldn't record outcome. Try again." });
  }
  return res.json({ ok: true, outcome, realisedR });
};
