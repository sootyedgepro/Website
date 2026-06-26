// POST /api/analyze/feedback
// User reports whether Dex's grade was helpful/accurate (before the trade plays
// out — distinct from track-outcome). Writes to the same DexGrades row.
//
// Body: { gradeId: string, email: string, helpful: boolean, notes?: string }

const airtable = require("../_lib/airtable");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  const { gradeId, email, helpful, notes } = req.body || {};

  if (!gradeId || typeof gradeId !== "string") {
    return res.status(400).json({ error: "gradeId required" });
  }
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "email required" });
  }
  if (typeof helpful !== "boolean") {
    return res.status(400).json({ error: "helpful (boolean) required" });
  }

  const ok = await airtable.logOutcome(gradeId, {
    user_feedback_helpful: helpful,
    user_feedback_text: typeof notes === "string" ? notes.slice(0, 2000) : "",
    user_feedback_at: new Date().toISOString(),
    user_feedback_email: email,
  });

  if (!ok) {
    return res.status(500).json({ error: "Couldn't record feedback. Try again." });
  }
  return res.json({ ok: true });
};
