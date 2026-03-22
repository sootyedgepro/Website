import Anthropic from "@anthropic-ai/sdk";
import Airtable from "airtable";

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
- Acknowledge their answer briefly before asking the next question (e.g. "Nice!" / "Got it." / "That makes sense.")
- Never ask more than one question in a single message.
- Keep responses SHORT — 1-2 sentences max before asking the next question.
- Sound like a knowledgeable trader, not a corporate bot.
- If they go off-topic, gently redirect back to the next question.

AFTER ALL 4 QUESTIONS ARE ANSWERED:
You will receive routing instructions in the next system message. Follow them exactly.

TRACKING:
Internally track which question you're on (1-4). When all 4 are answered, output a special JSON block at the END of your message (after your normal response) in this exact format:
<LEAD_DATA>
{
  "name": "extracted name or null",
  "q1_markets": "their answer",
  "q2_experience": "their answer",
  "q3_challenge": "their answer",
  "q4_budget": "their answer",
  "budget_amount": estimated numeric monthly budget as integer or null,
  "trades_forex_crypto": true or false based on whether they mentioned forex or crypto,
  "qualification_complete": true
}
</LEAD_DATA>`;

function scoreLabel(leadData) {
  const { budget_amount, trades_forex_crypto } = leadData;
  if (budget_amount >= 500 && trades_forex_crypto) return "HOT";
  if (budget_amount > 0 && budget_amount < 500) return "WARM";
  return "COLD";
}

function buildRoutingMessage(leadData) {
  const { budget_amount, trades_forex_crypto } = leadData;
  if (budget_amount >= 500 && trades_forex_crypto) {
    return `ROUTING: HOT LEAD
The user qualifies for a discovery call. Budget $${budget_amount}/mo, trades forex/crypto.
Tell them they're a great fit, that you'd love to have them speak with the team, and share this booking link: ${process.env.CAL_BOOKING_LINK}
Be enthusiastic but not salesy. Keep it to 3 sentences max. Do NOT output any JSON.`;
  }
  if (budget_amount < 500 && budget_amount > 0) {
    return `ROUTING: WARM LEAD
The user has some budget but under $500/mo.
Pitch the ${process.env.BRAND_NAME} Discord community at $99/month — real traders, daily signals, live Q&A.
Share this link: ${process.env.DISCORD_LINK}
Be encouraging, mention the low price point relative to potential gains. 2-3 sentences max. Do NOT output any JSON.`;
  }
  return `ROUTING: COLD LEAD
The user is new or has no budget right now.
Be kind and encouraging. Tell them everyone starts somewhere.
Give them a free resource to get started: ${process.env.FREE_RESOURCE_LINK}
Wish them well and close the conversation warmly. 2-3 sentences. Do NOT output any JSON.`;
}

// In-memory session store (resets on cold start — acceptable for serverless)
const sessions = new Map();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  const { message, sessionId: clientSessionId } = req.body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "message is required" });
  }

  const sessionId = clientSessionId || crypto.randomUUID();
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { messages: [], leadData: null, logged: false });
  }
  const session = sessions.get(sessionId);
  session.messages.push({ role: "user", content: message.trim() });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const systemMessages = [{ type: "text", text: SYSTEM_PROMPT }];

  if (session.leadData?.qualification_complete) {
    systemMessages.push({ type: "text", text: buildRoutingMessage(session.leadData) });
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: systemMessages,
      messages: session.messages,
    });

    const rawText = response.content[0].text;
    const jsonMatch = rawText.match(/<LEAD_DATA>([\s\S]*?)<\/LEAD_DATA>/);
    let extractedLeadData = null;

    if (jsonMatch) {
      try { extractedLeadData = JSON.parse(jsonMatch[1].trim()); } catch {}
    }

    const cleanText = rawText.replace(/<LEAD_DATA>[\s\S]*?<\/LEAD_DATA>/, "").trim();
    session.messages.push({ role: "assistant", content: cleanText });

    if (extractedLeadData?.qualification_complete && !session.leadData) {
      session.leadData = extractedLeadData;
      const score = scoreLabel(extractedLeadData);

      // Log to Airtable async
      if (!session.logged) {
        session.logged = true;
        try {
          const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
          await base("Leads").create([{
            fields: {
              "Session ID": sessionId,
              Name: extractedLeadData.name || "Unknown",
              Markets: extractedLeadData.q1_markets || "",
              "Experience Level": extractedLeadData.q2_experience || "",
              "Biggest Challenge": extractedLeadData.q3_challenge || "",
              Budget: extractedLeadData.q4_budget || "",
              "Budget Amount ($/mo)": extractedLeadData.budget_amount || 0,
              "Trades Forex/Crypto": extractedLeadData.trades_forex_crypto ? "Yes" : "No",
              "Lead Score": score,
            }
          }]);
        } catch (err) {
          console.error("[Airtable] Error:", err.message);
        }
      }
    }

    return res.json({
      sessionId,
      message: cleanText,
      leadScore: session.leadData ? scoreLabel(session.leadData) : null,
      qualificationComplete: !!session.leadData?.qualification_complete,
    });
  } catch (err) {
    console.error("[Chat] Error:", err.message);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
