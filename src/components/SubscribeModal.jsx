import { useEffect, useRef, useState } from "react";

const SS_KEY = "se_sub_seen_v1";
const SS_DONE = "se_sub_done_v1";
const SCROLL_TRIGGER = 0.45;
const DELAY_MS = 25000;

export default function SubscribeModal() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const triggeredRef = useRef(false);
  const inputRef = useRef(null);

  const fire = () => {
    if (triggeredRef.current) return;
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(SS_KEY) || localStorage.getItem(SS_DONE)) return;
    } catch {}
    triggeredRef.current = true;
    try { sessionStorage.setItem(SS_KEY, "1"); } catch {}
    setOpen(true);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(SS_KEY) || localStorage.getItem(SS_DONE)) {
        triggeredRef.current = true;
        return;
      }
    } catch {}

    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      if (max > 0 && window.scrollY / max >= SCROLL_TRIGGER) fire();
    };
    const onMouseOut = (e) => {
      if (e.relatedTarget || e.toElement) return;
      if (e.clientY <= 2) fire();
    };
    const t = setTimeout(fire, DELAY_MS);

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("mouseout", onMouseOut);
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseout", onMouseOut);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const close = () => setOpen(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const v = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setError("Please enter a valid email address.");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: v, source: "exit-modal" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Subscription failed");
      }
      try { localStorage.setItem(SS_DONE, "1"); } catch {}
      setStatus("success");
    } catch (err) {
      setStatus("idle");
      setError(err.message || "Something went wrong. Try again.");
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={close}
      style={{
        position: "fixed", inset: 0, zIndex: 10050,
        background: "rgba(0,0,0,.78)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px", animation: "fadeUp .25s ease both",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="se-sub-title"
        style={{
          position: "relative",
          width: "100%", maxWidth: 480,
          background: "linear-gradient(180deg, rgba(18,18,22,.98) 0%, rgba(10,10,12,.98) 100%)",
          border: "1px solid rgba(255,214,0,.25)",
          borderRadius: 20,
          padding: "36px 32px 32px",
          boxShadow: "0 30px 90px rgba(0,0,0,.6), 0 0 60px rgba(255,214,0,.08)",
          fontFamily: "'Crimson Pro', Georgia, serif",
          color: "#D8D8E4",
        }}
      >
        <button
          onClick={close}
          aria-label="Close"
          className="hov"
          style={{
            position: "absolute", top: 12, right: 12,
            width: 32, height: 32, borderRadius: 8,
            background: "transparent", border: "1px solid rgba(255,255,255,.08)",
            color: "#606078", fontSize: 18, lineHeight: 1, cursor: "pointer",
          }}
        >×</button>

        {status === "success" ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif", letterSpacing: ".06em",
              fontSize: 28, color: "#FFD600", marginBottom: 12,
            }}>YOU'RE IN.</div>
            <p style={{ color: "#D8D8E4", fontSize: 16, lineHeight: 1.5, margin: 0 }}>
              Watch your inbox. Setups, market reads, and SootyEdge updates — no fluff.
            </p>
            <button
              onClick={close}
              className="hov"
              style={{
                marginTop: 22, padding: "10px 22px",
                background: "transparent", color: "#FFD600",
                border: "1px solid rgba(255,214,0,.35)",
                borderRadius: 999, fontFamily: "'Bebas Neue', sans-serif",
                letterSpacing: ".1em", fontSize: 13, cursor: "pointer",
              }}
            >CLOSE</button>
          </div>
        ) : (
          <>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11, letterSpacing: ".18em",
              color: "#FFD600", marginBottom: 14, textTransform: "uppercase",
            }}>FREE — SootyEdge Insider List</div>

            <h2 id="se-sub-title" style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 34, lineHeight: 1.05, letterSpacing: ".01em",
              color: "#fff", margin: "0 0 12px",
            }}>
              GET THE EDGE <span style={{ color: "#FFD600" }}>BEFORE</span> THE OPEN.
            </h2>

            <p style={{ color: "#A4A4B8", fontSize: 16, lineHeight: 1.55, margin: "0 0 22px" }}>
              Weekly setups, bias reads, and SootyEdge updates straight from the system.
              No spam. Unsubscribe anytime.
            </p>

            <form onSubmit={submit} noValidate>
              <input
                ref={inputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={status === "loading"}
                autoComplete="email"
                style={{
                  width: "100%", padding: "14px 16px",
                  background: "rgba(0,0,0,.4)",
                  border: "1px solid rgba(255,255,255,.1)",
                  borderRadius: 10, color: "#fff",
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 15,
                  outline: "none", marginBottom: 12,
                }}
                onFocus={(e) => e.target.style.borderColor = "rgba(255,214,0,.5)"}
                onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,.1)"}
              />

              {error && (
                <div style={{
                  color: "#FF6666", fontSize: 13,
                  fontFamily: "'JetBrains Mono', monospace",
                  marginBottom: 12,
                }}>{error}</div>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="hov"
                style={{
                  width: "100%", padding: "14px",
                  background: status === "loading" ? "#B89400" : "#FFD600",
                  color: "#0a0a0a", border: "none", borderRadius: 10,
                  fontFamily: "'Bebas Neue', sans-serif",
                  letterSpacing: ".12em", fontSize: 15,
                  cursor: status === "loading" ? "wait" : "pointer",
                  transition: "all .15s ease",
                }}
              >
                {status === "loading" ? "JOINING…" : "JOIN THE LIST"}
              </button>
            </form>

            <p style={{
              marginTop: 14, fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              color: "#606078", textAlign: "center", letterSpacing: ".05em",
            }}>
              By subscribing you agree to receive email from SootyEdge.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
