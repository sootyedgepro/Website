module.exports = async function handler(req, res) {
  try {
    const Anthropic = require("@anthropic-ai/sdk");
    const { v4: uuidv4 } = require("uuid");
    res.json({
      ok: true,
      env: !!process.env.ANTHROPIC_API_KEY,
      anthropic: !!Anthropic,
      uuid: !!uuidv4,
      key_prefix: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.slice(0, 10) : "missing"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
