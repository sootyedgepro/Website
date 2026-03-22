const Anthropic = require("@anthropic-ai/sdk");
const { v4: uuidv4 } = require("uuid");

const SYSTEM_PROMPT = `You are a friendly, conversational sales assistant for ${
  process.env.BRAND_NAME || "SootyEdge"
}, a premium trading software and education company.

Your job is to qualify leads by having a natural chat conversation — NOT a robotic form. Be warm, brief, and human. Use casual language. Max 2 sentences per response unless explaining something important.

QUALIFICATION FLOW:
You must collect answers to these 4 questions IN ORDER, one at a time:
1. What markets do you currently trade?
2. How long have you been trading?
3. What's your biggest challenge right now?
4. What's your monthly budget for trading tools and education?

RULES:
- Start by greeting them and asking their first name, then immediately move to Question 1.
- Ask only ONE question at a time. Wait for their answer before proceeding.
- Acknowledge their answer briefly before asking the next question.
- Never ask more than one question in a single message.
- Keep responses SHORT — 1-2 sentences max before asking the next question.
- Sound like a knowledgeable trader, not a corporate bot.

TRACKING:
When all 4 questions are answered, output a JSON block at the END of your message:
<LEAD_DATA>
{
  "name": "extracted name or null",
  "q1_markets": "their answer",
  "q2_experience": "their answer",
  "q3_challenge": "their answer",
  "q4_budget": "their answer",
  "budget_amount": estimated numeric monthly budget as integer or null,
  "trades_forex_crypto": true or false,
  "qualification_complete": true
}
</LEAD_DATA>`;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const sessionId = uuidv4();

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: [{ type: "text", text: SYSTEM_PROMPT }],
      messages: [{ role: "user", content: "hi" }],
    });

    const rawText = response.content[0].text;
    const cleanText = rawText.replace(/<LEAD_DATA>[\s\S]*?<\/LEAD_DATA>/, "").trim();

    return res.json({ sessionId, message: cleanText });
  } catch (err) {
    console.error("[Chat/Start] Error:", err.message);
    return res.status(500).json({ error: "Failed to start session." });
  }
}
