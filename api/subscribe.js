const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RESULTS = {
  over: {
    name: "The Overtrader",
    tag: "You're trading on volume, not edge.",
    pattern: "Your dominant pattern is overtrading with no enforced structure. The number of trades you take has almost nothing to do with how much real opportunity is actually in the market that day.",
    cost: "It costs you the one thing a developing trader needs most — clean data. Buried inside 30, 50, 100 trades a day, you cannot tell what is working, so you cannot improve. Meanwhile fees and small losses bleed the account every session.",
    fix: "Your first fix is not willpower and it is not a sticky note. It is an enforced cap: a hard maximum trade count, a hard cut-off time, and a forced break after every single trade.",
  },
  hop: {
    name: "The Strategy Hopper",
    tag: "You treat every loss as a knowledge gap.",
    pattern: "Your dominant pattern is strategy hopping. Every losing run sends you hunting for a new system, indicator or concept — so you almost never trade the same approach twice.",
    cost: "It costs you years. You never give a single strategy enough data to know whether it actually works, so you are permanently starting over. More information is making you worse, not better.",
    fix: "Your first fix is subtraction, not addition: pick ONE strategy, define your A+, B and C setup criteria in writing, and test it across 100 trades at a fixed risk before you change a thing.",
  },
  rev: {
    name: "The Revenge Trader",
    tag: "One loss flips a switch — and you chase.",
    pattern: "Your dominant pattern is revenge trading. A single loss triggers a string of impulsive trades to “make it back”, driven by competitiveness and a deep dislike of being wrong.",
    cost: "It costs you your biggest drawdowns. If you reviewed your data honestly, almost all of your worst damage happens in the 10–15 minutes right after a loss — not from your strategy, but from your reaction to it.",
    fix: "Your first fix is a circuit breaker: a hard 10-minute gap between every trade, and a daily max-loss rule that ends your session — enforced, not optional.",
  },
  prof: {
    name: "The Premature Profit-Taker",
    tag: "You cut winners early and let losers run.",
    pattern: "Your dominant pattern is broken trade management. You take profit before your target, you add to losing trades, and you react to your P&L instead of to price.",
    cost: "It costs you your risk-to-reward. Small wins and big losses is the exact inverse of an edge — you can be right most of the time and still lose money overall.",
    fix: "Your first fix is mechanical: switch your candles to black and white so colour stops driving you, scale out on a written plan, and let trades reach a defined target.",
  },
  ham: {
    name: "The Prop-Firm Hamster",
    tag: "You keep getting funded — and keep losing it.",
    pattern: "Your dominant pattern is prop-firm churning. You buy challenge after challenge, chase the payout window, and end up trading the firm's rules instead of an actual edge.",
    cost: "It costs you real money — hundreds to thousands a year in fees — and, worse, it costs you the chance to build a tested edge, because every reset wipes out the experiment.",
    fix: "Your first fix is to stop buying challenges until you have a strategy proven on consistent risk. Build the edge that earns and holds payouts — then let funding be a bridge, not a slot machine.",
  },
  plat: {
    name: "The Plateau Trader",
    tag: "Years in, stuck at break-even, doubting yourself.",
    pattern: "Your dominant pattern is the plateau. You have put in the time and you are not blowing up — but you are not progressing either, and imposter syndrome is creeping in.",
    cost: "What it costs you is not mainly money — it is momentum and belief. You compare yourself to louder traders and quietly wonder whether you are really cut out for this.",
    fix: "Your first fix is not more information — you already have plenty. It is a real feedback loop and outside accountability: defined milestones, a weekly review, and people who can see your blind spots.",
  },
};

function lookupResult(input) {
  if (!input) return null;
  if (RESULTS[input]) return { key: input, ...RESULTS[input] };
  const lower = String(input).toLowerCase();
  for (const k of Object.keys(RESULTS)) {
    if (RESULTS[k].name.toLowerCase() === lower) return { key: k, ...RESULTS[k] };
  }
  return null;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function emailHtml(r) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#101b21;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#EAF0F1;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#101b21;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#16242B;border:1px solid #33474F;border-radius:14px;overflow:hidden;">
      <tr><td style="padding:24px 28px;border-bottom:1px solid #33474F;">
        <div style="font-size:12px;letter-spacing:3px;font-weight:800;color:#16B5A6;">SOOTYEDGE</div>
      </td></tr>
      <tr><td style="padding:28px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:2.5px;color:#CFA24E;text-transform:uppercase;margin-bottom:10px;">Your Diagnostic Result</div>
        <h1 style="margin:0 0 8px;font-size:30px;line-height:1.1;color:#16B5A6;font-weight:800;letter-spacing:-.4px;">${escapeHtml(r.name)}</h1>
        <p style="margin:0 0 22px;font-style:italic;color:#EAF0F1;font-size:16px;line-height:1.5;">${escapeHtml(r.tag)}</p>

        <div style="background:#1F333C;border:1px solid #33474F;border-left:4px solid #0E6E6B;border-radius:10px;padding:16px 18px;margin-bottom:12px;">
          <div style="font-size:11px;font-weight:800;letter-spacing:1.8px;color:#16B5A6;margin-bottom:8px;">YOUR PATTERN</div>
          <div style="font-size:14.5px;line-height:1.6;color:#EAF0F1;">${escapeHtml(r.pattern)}</div>
        </div>

        <div style="background:#1F333C;border:1px solid #33474F;border-left:4px solid #D9695F;border-radius:10px;padding:16px 18px;margin-bottom:12px;">
          <div style="font-size:11px;font-weight:800;letter-spacing:1.8px;color:#D9695F;margin-bottom:8px;">WHAT IT'S COSTING YOU</div>
          <div style="font-size:14.5px;line-height:1.6;color:#EAF0F1;">${escapeHtml(r.cost)}</div>
        </div>

        <div style="background:#243942;border:1px solid #33474F;border-left:4px solid #16B5A6;border-radius:10px;padding:16px 18px;margin-bottom:24px;">
          <div style="font-size:11px;font-weight:800;letter-spacing:1.8px;color:#16B5A6;margin-bottom:8px;">YOUR FIRST FIX</div>
          <div style="font-size:14.5px;line-height:1.6;color:#EAF0F1;">${escapeHtml(r.fix)}</div>
        </div>

        <div style="background:linear-gradient(160deg,#1d3a39,#16282e);border:1px solid #0E6E6B;border-radius:12px;padding:22px;margin-bottom:20px;">
          <div style="font-size:17px;font-weight:800;color:#EAF0F1;line-height:1.3;margin-bottom:8px;">Want to go deeper?</div>
          <p style="margin:0 0 16px;color:#9FB0B5;font-size:14px;line-height:1.55;">Join the SootyEdge Discord. Real traders working through the same patterns share what's actually working — and you'll be first to know when the next Edge masterclass goes live.</p>
          <a href="https://discord.gg/wztT2bD9N6" style="display:inline-block;background:#16B5A6;color:#06231f;font-weight:800;font-size:14px;letter-spacing:.4px;padding:12px 22px;border-radius:10px;text-decoration:none;">Join the Discord →</a>
        </div>

        <p style="margin:0;color:#9FB0B5;font-size:13px;line-height:1.6;">See you inside,<br/><strong style="color:#EAF0F1;">Zi — Founder, SootyEdge</strong></p>
      </td></tr>
      <tr><td style="padding:18px 28px;border-top:1px solid #33474F;font-size:11px;color:#6f8085;line-height:1.6;">
        Educational content only — not financial advice. Trading is high-risk and the majority of retail traders lose money. Your diagnostic result reflects your own answers and is a starting point for improvement, not a prediction or guarantee of any trading outcome.<br/><br/>
        You're receiving this because you took the Broken Trader Diagnostic at sootyedge.com. To unsubscribe, reply with the word UNSUBSCRIBE.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function emailText(r) {
  return `Your Diagnostic Result: ${r.name}
${r.tag}

YOUR PATTERN
${r.pattern}

WHAT IT'S COSTING YOU
${r.cost}

YOUR FIRST FIX
${r.fix}

Want to go deeper?
Join the SootyEdge Discord: https://discord.gg/wztT2bD9N6

See you inside,
Zi — Founder, SootyEdge

--
Educational content only — not financial advice. Trading is high-risk and the majority of retail traders lose money.
To unsubscribe, reply with UNSUBSCRIBE.`;
}

async function sendDiagnosticEmail(email, resultObj) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { skipped: true, reason: "no RESEND_API_KEY" };
  const from = process.env.RESEND_FROM || "SootyEdge <onboarding@resend.dev>";

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Your Broken Trader Diagnosis — " + resultObj.name,
        html: emailHtml(resultObj),
        text: emailText(resultObj),
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("[subscribe] resend failed", resp.status, errText);
      return { ok: false, status: resp.status, error: errText };
    }
    const json = await resp.json().catch(() => ({}));
    return { ok: true, id: json.id };
  } catch (e) {
    console.error("[subscribe] resend error", e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  }
}

async function pingDiscord(webhook, payload) {
  try {
    const resp = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      console.error("[subscribe] discord webhook failed", resp.status, await resp.text().catch(() => ""));
    }
  } catch (e) {
    console.error("[subscribe] discord webhook error", e?.message || e);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const email = String(body.email || "").trim().toLowerCase();
    const source = String(body.source || "unknown").slice(0, 64);
    const meta = (body && typeof body.meta === "object" && body.meta) || {};
    const patternInput = meta.pattern ? String(meta.pattern).slice(0, 80) : "";
    const patternKey = meta.patternKey ? String(meta.patternKey).slice(0, 16) : "";

    if (!EMAIL_RE.test(email) || email.length > 254) {
      return res.status(400).json({ error: "Invalid email" });
    }

    const result = lookupResult(patternKey) || lookupResult(patternInput);
    const patternName = result ? result.name : patternInput;

    const ip =
      (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
      req.socket?.remoteAddress || "";
    const ua = String(req.headers["user-agent"] || "").slice(0, 200);
    const ts = new Date().toISOString();

    console.log("[subscribe]", JSON.stringify({ ts, email, source, pattern: patternName, ip, ua }));

    const emailResult = result ? await sendDiagnosticEmail(email, result) : { skipped: true, reason: "no pattern" };
    if (emailResult.ok) {
      console.log("[subscribe] resend ok", emailResult.id || "");
    } else if (emailResult.skipped) {
      console.log("[subscribe] email skipped:", emailResult.reason);
    }

    const webhook = process.env.DISCORD_SUBSCRIBE_WEBHOOK;
    if (webhook) {
      const emailStatus = emailResult.ok ? "✅ sent" : emailResult.skipped ? "⏭ skipped" : "❌ failed";
      await pingDiscord(webhook, {
        username: "SootyEdge List",
        embeds: [{
          title: patternName ? "New diagnostic signup" : "New email subscriber",
          color: 0x16B5A6,
          fields: [
            { name: "Email", value: "`" + email + "`", inline: false },
            ...(patternName ? [{ name: "Pattern", value: patternName, inline: true }] : []),
            { name: "Source", value: source, inline: true },
            { name: "Email status", value: emailStatus, inline: true },
            { name: "Time (UTC)", value: ts, inline: true },
            ...(ip ? [{ name: "IP", value: ip, inline: true }] : []),
          ],
        }],
      });
    }

    return res.status(200).json({ ok: true, emailed: !!emailResult.ok });
  } catch (err) {
    console.error("[subscribe] error", err?.message || err);
    return res.status(500).json({ error: "Server error" });
  }
};
