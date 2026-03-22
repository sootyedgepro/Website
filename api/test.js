module.exports = async function handler(req, res) {
  res.json({ ok: true, env: !!process.env.ANTHROPIC_API_KEY });
};
