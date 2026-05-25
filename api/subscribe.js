const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const pattern = meta.pattern ? String(meta.pattern).slice(0, 80) : "";

    if (!EMAIL_RE.test(email) || email.length > 254) {
      return res.status(400).json({ error: "Invalid email" });
    }

    const ip =
      (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
      req.socket?.remoteAddress || "";
    const ua = String(req.headers["user-agent"] || "").slice(0, 200);
    const ts = new Date().toISOString();

    console.log("[subscribe]", JSON.stringify({ ts, email, source, pattern, ip, ua }));

    const webhook = process.env.DISCORD_SUBSCRIBE_WEBHOOK;
    if (webhook) {
      const payload = {
        username: "SootyEdge List",
        embeds: [{
          title: pattern ? "New diagnostic signup" : "New email subscriber",
          color: 0xFFD600,
          fields: [
            { name: "Email", value: "`" + email + "`", inline: false },
            ...(pattern ? [{ name: "Pattern", value: pattern, inline: true }] : []),
            { name: "Source", value: source, inline: true },
            { name: "Time (UTC)", value: ts, inline: true },
            ...(ip ? [{ name: "IP", value: ip, inline: true }] : []),
          ],
        }],
      };
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

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[subscribe] error", err?.message || err);
    return res.status(500).json({ error: "Server error" });
  }
};
