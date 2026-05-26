// Dex: standalone AI Trading Mentor product. Full-screen chat experience at
// /dex (production: tradegrader.live). NOT a widget on the marketing site;
// this IS the product.
//
// Backend: /api/dex/chat (multi-turn conversation with Anthropic tool-use).

import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, CandlestickSeries, LineStyle } from "lightweight-charts";
import { chatWithDex } from "../lib/dex-api";
import DexReactiveCore from "./DexReactiveCore.jsx";
import DexChatComposer from "./DexChatComposer.jsx";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./ui/tooltip.jsx";
import { WaveLoader } from "./loader.jsx";
import { motion, AnimatePresence, useMotionValue, useMotionTemplate, useAnimationFrame } from "framer-motion";

const STORAGE_KEY_SESSION = "dex.sessionId";
const STORAGE_KEY_HISTORY = "dex.history";
const STORAGE_KEY_EMAIL = "dex.email";

const GRADE_COLORS = {
  A: "#03CD00",
  B: "#00D4D4",
  C: "#FFD600",
  D: "#E07B00",
  F: "#FF3333",
};

const SUGGESTED_PROMPTS = [
  "Grade NVDA (1h)",
  "Play on TSLA right now",
  "How you grade a breakout",
  "Pull up SOFI chart",
];

// Builds a complete mock TSLA grade message (matches the schema returned by
// /api/dex/chat) so we can preview the response bubble + chart panel UI
// without depending on the backend / OAuth. Triggered from the profile
// popover's "Load demo TSLA grade" button. Safe to delete once OAuth works.
function buildDemoTSLAResponse() {
  // Generate ~60 synthetic daily OHLC bars around the $400 zone with a
  // realistic-feeling drift + range. Random-walk keeps it varied every call.
  const now = Math.floor(Date.now() / 1000);
  const dayS = 86400;
  let price = 372;
  const bars = [];
  for (let i = 59; i >= 0; i--) {
    const t = now - i * dayS;
    const drift = (Math.random() - 0.46) * 6; // slight upward bias
    const open = price;
    const close = +(price + drift).toFixed(2);
    const high = +(Math.max(open, close) + Math.random() * 4).toFixed(2);
    const low  = +(Math.min(open, close) - Math.random() * 4).toFixed(2);
    bars.push({ time: t, open: +open.toFixed(2), high, low, close });
    price = close;
  }
  const last = bars[bars.length - 1].close;
  return {
    sessionId: "demo-tsla",
    content:
      "Alright — pulling the TSLA tape now. Price is sitting just under the $400 Sell Zone with the Flow Tracker SCORE printing 56 (FIRE, bullish bias). RSI is at 58 and the EMA stack is fanned up, so the trend's intact but we're inside resistance. Here's the play:",
    grade: {
      grade: "B",
      risk_reward: "1:2.3",
      setup_type: "pullback",
      regime: "trending",
      ticker: "TSLA",
      timeframe: "1d",
      entry: +(last - 4).toFixed(2),
      entry_reason:
        "Pullback into the Retest Above band at " + (last - 4).toFixed(2) + ". Wait for a 1h bullish engulfing or hammer to confirm demand before triggering — entering blind into the band is C-grade behavior.",
      stop_loss: +(last - 14).toFixed(2),
      stop_reason:
        "Sooty Flow Support sits at " + (last - 14).toFixed(2) + " — that's the structural line in the sand. A daily close below it means the trend leg is done, regardless of intraday noise.",
      tp1: +(last + 9).toFixed(2),
      tp1_reason:
        "Strong Resist band at " + (last + 9).toFixed(2) + ". Take 50% off here, move stop to break-even. This is where the prior swing high sits and where Flow Tracker historically stalls on its first test.",
      tp2: +(last + 22).toFixed(2),
      tp2_reason:
        "Measured-move target from the base, lines up with the upper Bollinger at " + (last + 22).toFixed(2) + ". Trim another 30% and let the rest run.",
      tp3: +(last + 38).toFixed(2),
      tp3_reason:
        "Stretch target into the next supply cluster around " + (last + 38).toFixed(2) + ". Trailing stop only — most of the trade's reward is already locked in by TP1+TP2.",
      why_this_works:
        "Three confluences stack: (1) Flow Tracker SCORE 56 FIRE with bullish bias means the system is green-lighting longs. (2) Price is pulling INTO the Retest Above band, not breaking through it — historically a high-quality re-entry zone. (3) RSI 58 with MACD still posturing positive on the 1h says momentum hasn't rolled. The grade is B (not A) because price is already within $4 of a known resistance band, which caps the risk-reward.",
      what_youre_learning:
        "Confluence > a single signal. Notice how no individual indicator screams 'long' on its own — but stacked together they paint a tradable setup. Try the same exercise on your next chart: list the indicators, score each, and only pull the trigger when 3+ agree.",
      risk_alert:
        "1. Daily close below Sooty Flow Support (" + (last - 14).toFixed(2) + ") invalidates the thesis — exit, don't average down. 2. If Flow Tracker SCORE drops below 50 before entry triggers, walk away — the setup is no longer FIRE. 3. Watch the upcoming Wednesday delivery print; an unexpected miss tanks this setup regardless of technicals.",
      chart: {
        ticker: "TSLA",
        timeframe: "1d",
        bars,
        quote: { price: last, change: +(last - bars[0].close).toFixed(2) },
      },
    },
  };
}

// Credit packages — bigger packs come with bonus credits and a lower
// per-grade cost, encouraging scaled spend. Names lean trader-speak so the
// purchase feels on-brand. Tweak prices / credit counts as you like — these
// are placeholder values until Stripe + a real /api/checkout endpoint
// (Item 9 follow-up) land.
const PRICE_TIERS = [
  { name: "Scalp",         price: 5,   credits: 30                                },
  { name: "Swing",         price: 20,  credits: 150,  badge: "Most popular",
    featured: true                                                                },
  { name: "Position",      price: 50,  credits: 425,  badge: "Best value"        },
  { name: "Institutional", price: 100, credits: 1000                              },
];

export default function Dex() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [email, setEmail] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  // Profile popover open/close — driven by the avatar button in the header.
  const [profileOpen, setProfileOpen] = useState(false);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  // `heroState` drives the reactive 3D orb on the welcome screen. We derive
  // it from inputs Dex already tracks so the orb feels alive without each
  // upstream change having to know about it.
  //   sending → "thinking" (waiting on Anthropic)
  //   input typed → "typing" (user is composing)
  //   last assistant message arrived in last ~1.8s → "responding"
  //   otherwise → "idle"
  const [lastResponseAt, setLastResponseAt] = useState(0);
  const [tickNow, setTickNow] = useState(0);
  // Cheap re-render tick so the "responding" window closes naturally.
  useEffect(() => {
    if (!lastResponseAt) return;
    const t = setTimeout(() => setTickNow((n) => n + 1), 1800);
    return () => clearTimeout(t);
  }, [lastResponseAt]);
  const heroState = (() => {
    if (sending) return "thinking";
    if (lastResponseAt && Date.now() - lastResponseAt < 1800) return "responding";
    if (input && input.trim().length > 0) return "typing";
    return "idle";
  })();
  // Suppress lint on tickNow — its only job is to invalidate this closure.
  void tickNow;

  // Per-character pulse signal. We watch input *length* (not content) so
  // that pasting a chunk fires once, single keypresses fire once each, and
  // backspaces / deletions are ignored. The orb listens for pulseSignal
  // increments and injects a transient amp bump that decays on its own.
  const prevInputLenRef = useRef(0);
  const [pulseSignal, setPulseSignal] = useState(0);
  useEffect(() => {
    if (input.length > prevInputLenRef.current) {
      setPulseSignal((s) => s + 1);
    }
    prevInputLenRef.current = input.length;
  }, [input.length]);

  // Restore session + history on first mount.
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY_SESSION);
      const h = localStorage.getItem(STORAGE_KEY_HISTORY);
      const e = localStorage.getItem(STORAGE_KEY_EMAIL);
      if (s) setSessionId(s);
      if (e) setEmail(e);
      if (h) {
        const parsed = JSON.parse(h);
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {}
  }, []);

  // Persist history (capped at 50 messages).
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY_HISTORY,
        JSON.stringify(messages.slice(-50))
      );
    } catch {}
  }, [messages]);

  // Auto-scroll on new message.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // Auto-grow textarea.
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(
      textareaRef.current.scrollHeight,
      160
    )}px`;
  }, [input]);

  // Focus input on mount.
  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 200);
  }, []);

  async function send(text) {
    const t = (text ?? input).trim();
    if (!t || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: t }]);
    setSending(true);
    try {
      const data = await chatWithDex({
        sessionId,
        message: t,
        email: email || undefined,
      });
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        try {
          localStorage.setItem(STORAGE_KEY_SESSION, data.sessionId);
        } catch {}
      }
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.message || "", grade: data.grade || null },
      ]);
      setLastResponseAt(Date.now());
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            err.status === 429
              ? `Slow down. Rate limit hit. Try again in ${err.retryAfterSec ?? 60}s.`
              : err.status === 403
              ? "Active SootyEdge membership required to chat with Dex."
              : "I hit a snag on my side. Try that again?",
          isError: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // Holds the setTimeout id for an in-flight simulated-processing demo so
  // we can cancel it if the user resets/closes/triggers another simulation
  // mid-flight. Otherwise a stale timeout could fire after reset and leave
  // sending=true hung forever.
  const simTimeoutRef = useRef(null);

  function reset() {
    setMessages([]);
    setSessionId(null);
    setSending(false);
    if (simTimeoutRef.current) {
      clearTimeout(simTimeoutRef.current);
      simTimeoutRef.current = null;
    }
    try {
      localStorage.removeItem(STORAGE_KEY_SESSION);
      localStorage.removeItem(STORAGE_KEY_HISTORY);
    } catch {}
  }

  // Inject a mock TSLA grade straight into the message stream so the bubble
  // + chart panel can be visually iterated on without OAuth/API. Dev tool.
  function loadDemo() {
    const data = buildDemoTSLAResponse();
    setMessages((m) => [
      ...m,
      { role: "user", content: "Play on TSLA right now" },
      { role: "assistant", content: data.content, grade: data.grade },
    ]);
    setLastResponseAt(Date.now());
    setProfileOpen(false);
  }

  // Simulate the full send pipeline so processing animations (the Typing
  // indicator's pulsing wordmark, the composer's Send-button spinner, the
  // disabled-input state) can be tested without hitting the backend. Adds
  // a user message, flips sending=true for ~4 seconds, then drops in the
  // same mock TSLA grade.
  function simulateProcessing() {
    // Cancel any prior sim in-flight.
    if (simTimeoutRef.current) clearTimeout(simTimeoutRef.current);
    setMessages((m) => [
      ...m,
      { role: "user", content: "Play on TSLA right now" },
    ]);
    setSending(true);
    setProfileOpen(false);
    simTimeoutRef.current = setTimeout(() => {
      const data = buildDemoTSLAResponse();
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.content, grade: data.grade },
      ]);
      setSending(false);
      setLastResponseAt(Date.now());
      simTimeoutRef.current = null;
    }, 4000);
  }

  function saveEmail(v) {
    const trimmed = (v || "").trim();
    setEmail(trimmed);
    try {
      if (trimmed) localStorage.setItem(STORAGE_KEY_EMAIL, trimmed);
      else localStorage.removeItem(STORAGE_KEY_EMAIL);
    } catch {}
  }

  const empty = messages.length === 0;

  return (
    <TooltipProvider delayDuration={150}>
    <div className="dx-app">
      <style>{DEX_CSS}</style>
      <DexGridBG />

      <header className="dx-top">
        <a href="/dex" className="dx-top-brand" aria-label="SootyDex home">
          {/* Just the wordmark — symbol icon is dropped per design direction.
            * Swap to the Light variant when we add a light-mode toggle. */}
          <img src="/SD-WordM-Dark.svg" alt="SootyDex" className="dx-top-wm-img" />
        </a>
        <div className="dx-top-meta">
          {messages.length > 0 && (
            <button type="button" className="dx-top-btn" onClick={reset} title="New conversation">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              New chat
            </button>
          )}
          {/* Profile avatar trigger. Click will open the Profile popup once
           * the popup component is wired in (Item 8). For now it's a styled
           * button placeholder so the header treatment lands. */}
          <button
            type="button"
            className={`dx-top-avatar${profileOpen ? " is-open" : ""}`}
            aria-label="Open profile"
            aria-expanded={profileOpen}
            title="Profile"
            onClick={() => setProfileOpen((o) => !o)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>
        </div>
      </header>

      {empty ? (
        <Welcome heroState={heroState} pulseSignal={pulseSignal} />
      ) : (
        <main className="dx-stream" ref={scrollRef}>
          <div className="dx-stream-in">
            {messages.map((m, i) => (
              <Bubble key={i} msg={m} />
            ))}
            {sending && <Typing />}
          </div>
        </main>
      )}

      <footer className="dx-foot">
        <DexChatComposer
          value={input}
          onChange={setInput}
          onSubmit={() => send()}
          placeholder={
            sending
              ? "Dex is reading the chart…"
              : empty
              ? "Drop a ticker, paste a setup, or ask anything…"
              : "Ask a follow-up, or try another ticker…"
          }
          disabled={sending}
          loading={sending}
          onVoice={() => setVoiceOpen(true)}
          // Show the pill prompts only on the empty/welcome screen, not in
          // the middle of an ongoing conversation. Click → submit immediately.
          suggestions={empty ? SUGGESTED_PROMPTS : []}
          onSuggestion={(s) => send(s)}
        />
        <div className="dx-foot-hint">
          Educational analysis · Not investment advice · Trade your own risk · <span className="dx-beta">Beta</span>
        </div>
      </footer>

      {voiceOpen && (
        <VoiceMode
          sessionId={sessionId}
          email={email}
          onSessionUpdate={(id) => {
            setSessionId(id);
            try { localStorage.setItem(STORAGE_KEY_SESSION, id); } catch {}
          }}
          onMessage={({ userText, replyText, grade }) => {
            setMessages((m) => [
              ...m,
              { role: "user", content: userText },
              { role: "assistant", content: replyText, grade: grade || null },
            ]);
          }}
          onClose={() => setVoiceOpen(false)}
        />
      )}

      {/* Profile popover. Lives at the root so it can position fixed to the
       * viewport and overlay everything else. Wrapped in AnimatePresence so
       * the open/close anims actually play. */}
      <AnimatePresence>
        {profileOpen && (
          <ProfilePopover
            email={email}
            onEmail={saveEmail}
            onClose={() => setProfileOpen(false)}
            onClearHistory={() => {
              reset();
              setProfileOpen(false);
            }}
            onLoadDemo={loadDemo}
            onSimulate={simulateProcessing}
            messageCount={messages.length}
          />
        )}
      </AnimatePresence>
    </div>
    </TooltipProvider>
  );
}

// ──────────────────────────────────────────────────────────────────────────

// Profile popover. A small floating panel anchored to the avatar in the
// header. Holds the email field (moved out of the welcome screen) and a
// "clear chat" action. Click backdrop or press Escape to dismiss.
//
// This is a placeholder for the full Profile design in Rawki/profile.tsx —
// that one needs `card`, `avatar`, `progress` shadcn components plus a
// modern lucide-react before it can render. This minimal version covers the
// functional gap so the avatar button is actually useful today.
function ProfilePopover({ email, onEmail, onClose, onClearHistory, onLoadDemo, onSimulate, messageCount }) {
  // Escape dismisses.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Transparent backdrop catches outside-click. */}
      <motion.div
        className="dx-profile-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
      />
      <motion.div
        className="dx-profile-pop"
        initial={{ opacity: 0, y: -10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.96 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        role="dialog"
        aria-label="Profile"
      >
        <div className="dx-profile-head">
          <div className="dx-profile-ring" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="dx-profile-meta">
            <div className="dx-profile-name">{email ? email.split("@")[0] : "Guest trader"}</div>
            <div className="dx-profile-sub">{email || "Add an email to save your history"}</div>
          </div>
        </div>

        <div className="dx-profile-row">
          <label className="dx-profile-label" htmlFor="dx-profile-email">Email</label>
          <input
            id="dx-profile-email"
            type="email"
            className="dx-profile-input"
            placeholder="you@example.com"
            defaultValue={email || ""}
            onBlur={(e) => onEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onEmail(e.currentTarget.value);
              }
            }}
          />
          <div className="dx-profile-hint">
            Saves your grades and chat history across sessions.
          </div>
        </div>

        <div className="dx-profile-stats">
          <div className="dx-profile-stat">
            <div className="dx-profile-stat-n">{messageCount}</div>
            <div className="dx-profile-stat-l">Messages</div>
          </div>
          <div className="dx-profile-stat">
            <div className="dx-profile-stat-n">Beta</div>
            <div className="dx-profile-stat-l">Plan</div>
          </div>
        </div>

        {/* Credit packages — Item 9's pricing lives here. Clicking a tier
         * currently logs; wire to /api/checkout (Stripe) when ready. */}
        <div className="dx-profile-section">
          <div className="dx-profile-section-title">
            <span>Get more credits</span>
            <span className="dx-profile-section-sub">per grade gets cheaper at scale</span>
          </div>
          <div className="dx-profile-tiers">
            {PRICE_TIERS.map((t) => (
              <button
                key={t.name}
                type="button"
                className={`dx-profile-tier${t.featured ? " is-featured" : ""}`}
                onClick={() => {
                  // TODO: hook to Stripe checkout. For now, log so we can
                  // verify the click path.
                  console.log("[dex] tier select", t.name, `$${t.price}`);
                }}
              >
                <div className="dx-tier-row">
                  <span className="dx-tier-name">{t.name}</span>
                  {t.badge && <span className="dx-tier-badge">{t.badge}</span>}
                </div>
                <div className="dx-tier-row dx-tier-row-end">
                  <span className="dx-tier-credits">{t.credits} grades</span>
                  <span className="dx-tier-price">${t.price}</span>
                </div>
                <div className="dx-tier-perunit">
                  ${(t.price / t.credits).toFixed(2)} per grade
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="dx-profile-actions">
          {/* Dev tools. Remove this whole block once real backend chat
           * (OAuth or API key) is verified. */}
          {onSimulate && (
            <button
              type="button"
              className="dx-profile-btn dx-profile-btn-secondary"
              onClick={onSimulate}
              title="Add a user message, hold sending=true for 4s (Typing indicator), then drop a mock grade"
            >
              Simulate processing (4s)
            </button>
          )}
          {onLoadDemo && (
            <button
              type="button"
              className="dx-profile-btn dx-profile-btn-secondary"
              onClick={onLoadDemo}
              title="Inject a mock TSLA grade instantly (skips processing)"
            >
              Load demo TSLA grade
            </button>
          )}
          <button
            type="button"
            className="dx-profile-btn"
            onClick={onClearHistory}
            disabled={messageCount === 0}
            title={messageCount === 0 ? "Nothing to clear" : "Clear conversation history"}
          >
            Clear chat history
          </button>
        </div>

        <div className="dx-profile-foot">
          Billing &amp; history dashboard — coming soon.
        </div>
      </motion.div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────

// Scrolling grid behind the whole Dex view, adapted from the-infinite-grid.jsx
// into a background-only layer. Two layers: a dim base grid that's always
// visible, and a brighter grid revealed only where the cursor is (via a
// CSS radial-gradient mask). Both share the same scrolling pattern offset.
//
// Motion values drive the offset + cursor position directly so there's no
// per-frame React re-render — the SVG attributes and CSS mask read from
// MotionValues at the DOM level.
function DexGridBG() {
  // Scrolling offset (loops at 44px to match the pattern tile size).
  const ox = useMotionValue(0);
  const oy = useMotionValue(0);
  useAnimationFrame(() => {
    ox.set((ox.get() + 0.2) % 44);
    oy.set((oy.get() + 0.2) % 44);
  });

  // Cursor coords in viewport space. Initialized off-screen so the bright
  // grid isn't revealed in the corner before the user moves the mouse.
  const mx = useMotionValue(-9999);
  const my = useMotionValue(-9999);
  useEffect(() => {
    const onMove = (e) => {
      mx.set(e.clientX);
      my.set(e.clientY);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mx, my]);
  const mask = useMotionTemplate`radial-gradient(360px circle at ${mx}px ${my}px, black 0%, black 30%, transparent 75%)`;

  // Tiny helper so the two layers share the same scrolling pattern without
  // re-implementing the SVG twice. The stroke + opacity come in via props so
  // the two layers can read at different intensities (dim vs bright).
  const Grid = ({ id, stroke }) => (
    <svg width="100%" height="100%">
      <defs>
        <motion.pattern
          id={id}
          width="44"
          height="44"
          patternUnits="userSpaceOnUse"
          x={ox}
          y={oy}
        >
          <path d="M 44 0 L 0 0 0 44" fill="none" stroke={stroke} strokeWidth="1" />
        </motion.pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );

  return (
    <>
      {/* Dim baseline — always faintly visible across the whole viewport. */}
      <div className="dx-grid-bg dx-grid-bg-dim" aria-hidden="true">
        <Grid id="dx-grid-pattern-dim" stroke="rgba(255,214,0,0.05)" />
      </div>
      {/* Bright reveal — only the area around the cursor brightens, courtesy
       * of the CSS mask-image radial gradient. */}
      <motion.div
        className="dx-grid-bg dx-grid-bg-bright"
        aria-hidden="true"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        <Grid id="dx-grid-pattern-bright" stroke="rgba(255,214,0,0.32)" />
      </motion.div>
    </>
  );
}

// Tiny typewriter: renders `text` one character at a time, calls onDone when
// it lands on the final character. While it's still typing it renders a
// blinking caret after the visible substring. Plain text only (no JSX content
// — keep markup outside).
function Typewriter({ text, speed = 28, onDone, active = true }) {
  const [shown, setShown] = useState("");
  const doneRef = useRef(false);
  useEffect(() => {
    if (!active) return;
    setShown("");
    doneRef.current = false;
    let i = 0;
    let timer;
    const step = () => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        if (!doneRef.current) {
          doneRef.current = true;
          if (onDone) onDone();
        }
        return;
      }
      timer = setTimeout(step, speed);
    };
    timer = setTimeout(step, speed);
    return () => clearTimeout(timer);
  }, [text, speed, active]);
  return (
    <>
      {shown}
      {!doneRef.current && <span className="dx-caret" />}
    </>
  );
}

function Welcome({ heroState = "idle", pulseSignal = 0 }) {
  // Welcome reads like Dex actually speaking: each line types out character
  // by character, with a blinking caret on the active line. While he's
  // "talking" the orb is forced into its "responding" state so it pulses in
  // sync with the words. Once all three lines have landed, the block sits
  // for ~6s then fades away — orb, pills, composer take over.
  // (Email collection moved to the Profile popup — Item 8.)
  const [stage, setStage] = useState(0); // 0=h1, 1=sub1, 2=sub2, 3=all done
  const [textVisible, setTextVisible] = useState(true);
  const isTyping = stage < 3;
  // Override the parent's heroState while Dex is mid-sentence.
  const effectiveHeroState = isTyping ? "responding" : heroState;

  // Once the last line finishes typing, give it a beat then fade out.
  useEffect(() => {
    if (stage < 3) return;
    const t = setTimeout(() => setTextVisible(false), 6000);
    return () => clearTimeout(t);
  }, [stage]);

  return (
    <main className="dx-welcome">
      <div className="dx-welcome-in">
        <motion.div
          className="dx-welcome-eyebrow"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <span className="dx-welcome-tag">TradeGrader</span>
          <span className="dx-welcome-sep" />
          <span className="dx-welcome-tag-dim">AI Trading Mentor</span>
        </motion.div>

        <motion.div
          className="dx-welcome-avatar"
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
        >
          <DexReactiveCore state={effectiveHeroState} size={280} pulseSignal={pulseSignal} />
        </motion.div>

        {/* Greeting block: each line types in sequence. The whole block sits
         * inside AnimatePresence so the auto-fade exits gracefully. */}
        <AnimatePresence>
          {textVisible && (
            <motion.div
              key="dx-greeting"
              className="dx-welcome-greeting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -10, transition: { duration: 0.7, ease: "easeIn" } }}
              transition={{ duration: 0.35 }}
            >
              {/* Line 1 — types first. */}
              <h1 className="dx-welcome-h1">
                {stage >= 0 && (
                  <Typewriter
                    text="Hey — I'm Dex."
                    speed={55}
                    onDone={() => setStage((s) => Math.max(s, 1))}
                    active={stage >= 0}
                  />
                )}
              </h1>

              {/* Line 2 — kicks off once line 1 finishes. */}
              <p className="dx-welcome-sub">
                {stage >= 1 ? (
                  <Typewriter
                    text="Your AI trading mentor."
                    speed={32}
                    onDone={() => setStage((s) => Math.max(s, 2))}
                    active={stage >= 1}
                  />
                ) : (
                  // Empty placeholder keeps vertical rhythm before line 2 starts.
                  <span style={{ opacity: 0 }}>placeholder</span>
                )}
              </p>

              {/* Line 3 — kicks off once line 2 finishes. The "A through F"
               * is styled as the static em after the typewriter completes
               * its plain-text portion. */}
              <p className="dx-welcome-sub">
                {stage >= 2 ? (
                  <Typewriter
                    text="Drop a ticker, paste a setup, or just ask. I'll pull the data, run the technicals, and grade the play A through F."
                    speed={22}
                    onDone={() => setStage((s) => Math.max(s, 3))}
                    active={stage >= 2}
                  />
                ) : (
                  <span style={{ opacity: 0 }}>placeholder</span>
                )}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Suggestion pills live in the composer (DexChatComposer.jsx).
         * Email collection lives in the Profile popup (Item 8). */}
      </div>
    </main>
  );
}

function Bubble({ msg }) {
  // Graded message gets the full trade-terminal panel (breaks out of the
  // narrow chat column). We still wrap it in the same bubble-row shell as
  // text replies so the wordmark "Dex" label appears above — without that,
  // a grade just lands in the stream with no identifier and reads as a
  // disconnected block ("cuts off").
  if (msg.role === "assistant" && msg.grade) {
    // Graded responses get their own full-width row OUTSIDE the .dx-bub-col
    // 620px constraint. Wordmark label sits above the panel so the message
    // is still identified as Dex, but the panel itself reads as a hub /
    // dashboard rather than a chat bubble.
    return (
      <div className="dx-grade-row">
        <div className="dx-grade-label">
          <img src="/SD-WordM-Dark.svg" alt="Dex" className="dx-bub-wm" />
        </div>
        <TradePanel grade={msg.grade} text={msg.content} />
      </div>
    );
  }

  const isUser = msg.role === "user";
  return (
    <div className={`dx-bub-row ${isUser ? "is-user" : "is-bot"}${msg.isError ? " is-error" : ""}`}>
      {!isUser && (
        <div className="dx-bub-avatar">
          {/* Wordmark used as the response identifier per design direction —
           * reads as "Dex:" rather than a bare icon. Sized horizontally so
           * the chat row stays tight. */}
          <img src="/SD-WordM-Dark.svg" alt="Dex" className="dx-bub-wm" />
        </div>
      )}
      <div className="dx-bub-col">
        {msg.content && (
          <div className="dx-bub">
            <Text text={msg.content} />
          </div>
        )}
      </div>
    </div>
  );
}

function Text({ text }) {
  const paras = useMemo(
    () => text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    [text]
  );
  return (
    <>
      {paras.map((p, i) => (
        <p key={i} className="dx-bub-p">
          {p.split("\n").map((line, j, arr) => (
            <span key={j}>
              {line}
              {j < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </>
  );
}

function GradeCard({ grade }) {
  const color = GRADE_COLORS[grade.grade] || "#FFD600";
  const tps = [
    { label: "TP1", price: grade.tp1, reason: grade.tp1_reason, color: "#AADD00" },
    { label: "TP2", price: grade.tp2, reason: grade.tp2_reason, color: "#03CD00" },
    { label: "TP3", price: grade.tp3, reason: grade.tp3_reason, color: "#00D4D4" },
  ];
  return (
    <div className="dx-card" style={{ "--gc": color }}>
      <div className="dx-card-hero">
        <div className="dx-card-letter">
          <span className="dx-card-letter-glow" />
          <span className="dx-card-letter-ring" />
          <span className="dx-card-letter-text">{grade.grade}</span>
        </div>
        <div className="dx-card-meta">
          {grade.ticker && (
            <div className="dx-card-symbol-row">
              <span className="dx-card-symbol">{grade.ticker}</span>
              {grade.timeframe && (
                <span className="dx-card-tf">{grade.timeframe}</span>
              )}
            </div>
          )}
          <div className="dx-card-stats">
            {grade.risk_reward && (
              <Stat label="R:R" value={grade.risk_reward} color={color} />
            )}
            {grade.setup_type && (
              <Stat label="Setup" value={grade.setup_type} color="#00D4D4" />
            )}
            {grade.regime && (
              <Stat label="Regime" value={grade.regime} color="#c4c8d6" />
            )}
          </div>
        </div>
      </div>

      {grade.chart?.bars?.length > 0 && (
        <DexChart chart={grade.chart} grade={grade} />
      )}

      <div className="dx-card-section">
        <div className="dx-card-section-label">Trade plan</div>
        <div className="dx-card-lvls">
          <LvlRow
            label="Entry"
            price={grade.entry}
            reason={grade.entry_reason}
            color="#FFD600"
          />
          <LvlRow
            label="Stop"
            price={grade.stop_loss}
            reason={grade.stop_reason}
            color="#FF3333"
          />
          {tps.map((t) => (
            <LvlRow key={t.label} {...t} />
          ))}
        </div>
      </div>

      <div className="dx-card-insights">
        {grade.why_this_works && (
          <Insight title="Why this works" body={grade.why_this_works} color="#FFD600" />
        )}
        {grade.what_youre_learning && (
          <Insight
            title="What you're learning"
            body={grade.what_youre_learning}
            color="#00D4D4"
          />
        )}
        {grade.risk_alert && (
          <Insight title="Risk alert" body={grade.risk_alert} color="#FF3333" alert />
        )}
      </div>

      <div className="dx-card-foot">
        Educational analysis. Not investment advice. Trade your own risk.
      </div>
    </div>
  );
}

function DexChart({ chart, grade, height = 260 }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !chart?.bars?.length) return;

    const chartInstance = createChart(el, {
      width: el.clientWidth,
      height,
      layout: {
        background: { type: "solid", color: "transparent" },
        textColor: "#8b90a8",
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.035)" },
        horzLines: { color: "rgba(255, 255, 255, 0.035)" },
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.06)",
        timeVisible: false,
        secondsVisible: false,
        rightOffset: 6,
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.06)",
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: "rgba(255, 214, 0, 0.4)", width: 1, style: 2 },
        horzLine: { color: "rgba(255, 214, 0, 0.4)", width: 1, style: 2 },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
    });

    const COLOR_UP = "#03CD00";
    const COLOR_DOWN = "#FF3333";

    const series = chartInstance.addSeries(CandlestickSeries, {
      upColor: COLOR_UP,
      downColor: COLOR_DOWN,
      borderVisible: true,
      borderUpColor: "#000000",
      borderDownColor: "#000000",
      wickUpColor: "#FFFFFF",
      wickDownColor: "#FFFFFF",
    });

    // "Color bars based on previous close" — each bar's color = current close
    // vs previous bar's close (not its own open vs close).
    const coloredBars = chart.bars.map((bar, i) => {
      const prevClose = i > 0 ? chart.bars[i - 1].close : bar.open;
      const isUp = bar.close >= prevClose;
      return {
        time: bar.time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        color: isUp ? COLOR_UP : COLOR_DOWN,
        borderColor: "#000000",
        wickColor: "#FFFFFF",
      };
    });

    series.setData(coloredBars);

    const levels = [
      { price: grade?.entry, color: "#FFD600", title: "Entry" },
      { price: grade?.stop_loss, color: "#FF3333", title: "Stop" },
      { price: grade?.tp1, color: "#03CD00", title: "TP1" },
      { price: grade?.tp2, color: "#03CD00", title: "TP2" },
      { price: grade?.tp3, color: "#03CD00", title: "TP3" },
    ];

    levels.forEach((l) => {
      if (l.price == null || Number.isNaN(Number(l.price))) return;
      series.createPriceLine({
        price: Number(l.price),
        color: l.color,
        lineWidth: 1.5,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: l.title,
      });
    });

    chartInstance.timeScale().fitContent();

    const resize = () => {
      if (containerRef.current) {
        chartInstance.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      chartInstance.remove();
    };
  }, [chart, grade, height]);

  if (!chart?.bars?.length) return null;

  return (
    <div className="dx-card-chart-wrap">
      <div className="dx-card-chart-head">
        <span className="dx-card-chart-label">{chart.ticker || ""}</span>
        <span className="dx-card-chart-tf">
          {chart.timeframe || "1d"} · last {chart.bars.length} bars
        </span>
      </div>
      <div className="dx-card-chart" ref={containerRef} style={{ height }} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// TradePanel — wide trade-terminal layout for graded messages
// ──────────────────────────────────────────────────────────────────────────

function TradePanel({ grade, text }) {
  const color = GRADE_COLORS[grade.grade] || "#FFD600";

  // Strip the human-readable grade code block from the prose so the breakdown
  // narrative isn't a duplicate of the structured panel.
  const narrative = useMemo(() => {
    if (!text) return "";
    return text
      .replace(/```[\s\S]*?```/g, "")
      .replace(/^---+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }, [text]);

  const tps = [
    { label: "TP1", price: grade.tp1, reason: grade.tp1_reason, color: "#03CD00" },
    { label: "TP2", price: grade.tp2, reason: grade.tp2_reason, color: "#03CD00" },
    { label: "TP3", price: grade.tp3, reason: grade.tp3_reason, color: "#03CD00" },
  ];

  return (
    <div className="dx-tp" style={{ "--gc": color }}>
      <div className="dx-tp-head">
        <div className="dx-tp-id">
          <GradeBadge letter={grade.grade} color={color} />
          <div className="dx-tp-id-info">
            {grade.ticker && <div className="dx-tp-ticker">{grade.ticker}</div>}
            <div className="dx-tp-sub">
              {grade.timeframe && <span>{grade.timeframe.toUpperCase()}</span>}
              {grade.setup_type && (
                <>
                  <span className="dx-tp-sub-sep">·</span>
                  <span>{grade.setup_type}</span>
                </>
              )}
              {grade.regime && (
                <>
                  <span className="dx-tp-sub-sep">·</span>
                  <span>{grade.regime}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="dx-tp-stats">
          {grade.risk_reward && <Stat label="R:R" value={grade.risk_reward} color="#FFFFFF" />}
          {grade.setup_type && <Stat label="Setup" value={grade.setup_type} color="#FFFFFF" />}
          {grade.regime && <Stat label="Regime" value={grade.regime} color="#FFFFFF" />}
        </div>
      </div>

      <div className="dx-tp-main">
        <aside className="dx-tp-left">
          <div className="dx-tp-section-label">
            <img src="/SD-WordM-Dark.svg" alt="Dex" className="dx-bub-wm" />
            <span>'s breakdown</span>
          </div>
          <div className="dx-tp-narrative">
            <Text text={narrative} />
          </div>
        </aside>

        <section className="dx-tp-right">
          <div className="dx-tp-chart">
            {grade.chart?.bars?.length > 0 ? (
              <DexChart chart={grade.chart} grade={grade} height={360} />
            ) : (
              <div className="dx-tp-chart-empty">
                Live chart unavailable for this grade.
              </div>
            )}
          </div>
          <div className="dx-tp-strip">
            <LevelChip label="Entry" price={grade.entry} color="#FFD600" reason={grade.entry_reason} />
            <LevelChip label="Stop" price={grade.stop_loss} color="#FF3333" reason={grade.stop_reason} />
            <LevelChip label="TP1" price={grade.tp1} color="#03CD00" reason={grade.tp1_reason} />
            <LevelChip label="TP2" price={grade.tp2} color="#03CD00" reason={grade.tp2_reason} />
            <LevelChip label="TP3" price={grade.tp3} color="#03CD00" reason={grade.tp3_reason} />
          </div>
        </section>
      </div>

      <div className="dx-tp-bottom">
        <div className="dx-card-insights">
          {grade.why_this_works && (
            <Insight title="Why this works" body={grade.why_this_works} color="#FFD600" />
          )}
          {grade.what_youre_learning && (
            <Insight
              title="What you're learning"
              body={grade.what_youre_learning}
              color="#00D4D4"
            />
          )}
          {grade.risk_alert && (
            <Insight title="Risk alert" body={grade.risk_alert} color="#FF3333" alert />
          )}
        </div>
        <div className="dx-card-foot">
          Educational analysis. Not investment advice. Trade your own risk.
        </div>
      </div>
    </div>
  );
}

// Modernized grade badge. Was a scalloped circular "seal" with gold gradient
// disc — read as a notarized stamp, didn't match the new flat-gray + bright-
// border dashboard. Now: solid dark tile, crisp 2px border in the grade
// color, big letter in the same color, tiny "Grade" eyebrow above. Lives
// in the same visual family as the .dx-card-stat / .dx-tp-chip tiles.
function GradeBadge({ letter, color, size = 80 }) {
  return (
    <div
      className="dx-grade-badge dx-tp-badge"
      style={{ "--gc": color, width: size, height: size }}
      aria-label={`Grade ${letter}`}
    >
      <span className="dx-grade-eyebrow">Grade</span>
      <span className="dx-grade-letter">{letter}</span>
      {/* Accent bar at the bottom — matches the level chips' 2px colored
        * border feel and gives the tile a directional weight. */}
      <span className="dx-grade-bar" />
    </div>
  );
}

function LevelChip({ label, price, color, reason }) {
  if (price == null) return null;
  const chip = (
    <div className="dx-tp-chip" style={{ "--cc": color, cursor: reason ? "help" : "default" }}>
      <span className="dx-tp-chip-l">{label}</span>
      <span className="dx-tp-chip-v">${price}</span>
    </div>
  );
  if (!reason) return chip;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      {/* className overrides shadcn's default Tailwind theme classes which
        * weren't resolving on this page (bg-popover was rendering invisible).
        * dx-tooltip is a plain CSS class defined in DEX_CSS. */}
      <TooltipContent side="top" sideOffset={8} className="dx-tooltip">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="dx-card-stat">
      <span className="dx-card-stat-l">{label}</span>
      <span className="dx-card-stat-v" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function LvlRow({ label, price, reason, color }) {
  if (price == null) return null;
  return (
    <div className="dx-card-lvl" style={{ "--lc": color }}>
      <span className="dx-card-lvl-bar" />
      <div className="dx-card-lvl-mark">
        <span className="dx-card-lvl-label">{label}</span>
        <span className="dx-card-lvl-price">${price}</span>
      </div>
      {reason && <p className="dx-card-lvl-reason">{reason}</p>}
    </div>
  );
}

function Insight({ title, body, color, alert }) {
  return (
    <div
      className={`dx-card-insight${alert ? " is-alert" : ""}`}
      style={{ "--ic": color }}
    >
      <div className="dx-card-insight-head">
        <span className="dx-card-insight-bar" />
        <span className="dx-card-insight-title">{title}</span>
      </div>
      <p className="dx-card-insight-body">{body}</p>
    </div>
  );
}

function Typing() {
  return (
    <div className="dx-bub-row is-bot dx-typing-row">
      <div className="dx-bub-avatar">
        <img src="/SD-WordM-Dark.svg" alt="Dex" className="dx-bub-wm is-pulsing" />
      </div>
      <div className="dx-bub dx-typing" style={{ "--primary": "#FFD600" }}>
        <WaveLoader size="lg" />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Voice mode
// ──────────────────────────────────────────────────────────────────────────

function stripMarkdownForSpeech(text) {
  if (!text) return "";
  return text
    .replace(/<DEX_GRADE>[\s\S]*?<\/DEX_GRADE>/g, "")
    .replace(/```[\s\S]*?```/g, ". ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, ". ")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ". ")
    .replace(/\s*\.\s*\./g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

function pickPreferredVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  // Prefer high-quality male English voices first.
  const prefs = [
    /^Daniel/i,
    /Microsoft Guy/i,
    /Google US English Male/i,
    /^Alex/i,
    /Microsoft Mark/i,
    /Google UK English Male/i,
    /^Tom/i,
  ];
  for (const re of prefs) {
    const v = voices.find((x) => re.test(x.name) && x.lang?.startsWith("en"));
    if (v) return v;
  }
  return (
    voices.find((v) => v.lang === "en-US") ||
    voices.find((v) => v.lang?.startsWith("en")) ||
    voices[0] ||
    null
  );
}

function VoiceMode({ sessionId, email, onSessionUpdate, onMessage, onClose }) {
  const [state, setState] = useState("idle"); // idle, listening, thinking, speaking, error
  const [transcript, setTranscript] = useState("");
  const [lastReply, setLastReply] = useState("");
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const finalTextRef = useRef("");
  const voiceRef = useRef(null);
  const sessionRef = useRef(sessionId);
  const shouldRestartRef = useRef(true);

  useEffect(() => {
    sessionRef.current = sessionId;
  }, [sessionId]);

  // Pick voice on mount + when voices change (some browsers populate async).
  useEffect(() => {
    const refresh = () => {
      voiceRef.current = pickPreferredVoice();
    };
    refresh();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = refresh;
    }
  }, []);

  // Initialize SpeechRecognition once.
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !window.speechSynthesis) {
      setError(
        "Voice mode needs Chrome, Edge, or Safari. Your browser doesn't support it."
      );
      setState("error");
      return;
    }
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";

    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalTextRef.current += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      setTranscript((finalTextRef.current + " " + interim).trim());

      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        const finalText = finalTextRef.current.trim();
        if (finalText) {
          finalTextRef.current = "";
          shouldRestartRef.current = false;
          try { r.stop(); } catch {}
          submit(finalText);
        }
      }, 1500);
    };

    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      console.warn("[dex-voice] recognition error:", e.error);
    };

    r.onend = () => {
      if (shouldRestartRef.current) {
        try { r.start(); } catch {}
      }
    };

    recognitionRef.current = r;

    return () => {
      shouldRestartRef.current = false;
      try { r.stop(); } catch {}
      try { window.speechSynthesis.cancel(); } catch {}
      clearTimeout(silenceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startListening() {
    if (!recognitionRef.current) return;
    setState("listening");
    setTranscript("");
    finalTextRef.current = "";
    shouldRestartRef.current = true;
    try { recognitionRef.current.start(); } catch {}
  }

  function stopListening() {
    if (!recognitionRef.current) return;
    shouldRestartRef.current = false;
    try { recognitionRef.current.stop(); } catch {}
  }

  async function submit(text) {
    setState("thinking");
    setLastReply("");
    try {
      const data = await chatWithDex({
        sessionId: sessionRef.current,
        message: text,
        email: email || undefined,
      });
      if (data.sessionId && data.sessionId !== sessionRef.current) {
        sessionRef.current = data.sessionId;
        onSessionUpdate(data.sessionId);
      }
      onMessage({
        userText: text,
        replyText: data.message,
        grade: data.grade || null,
      });
      speakReply(data.message);
    } catch (err) {
      setError(err.message || "Dex couldn't reply. Try again.");
      setState("error");
    }
  }

  function speakReply(text) {
    const clean = stripMarkdownForSpeech(text);
    if (!clean) {
      setState("idle");
      return;
    }
    setState("speaking");
    setLastReply(clean);
    try { window.speechSynthesis.cancel(); } catch {}
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 0.98;
    u.pitch = 1.0;
    u.volume = 1.0;
    if (voiceRef.current) u.voice = voiceRef.current;
    u.onend = () => {
      utteranceRef.current = null;
      setState("idle");
    };
    u.onerror = () => {
      utteranceRef.current = null;
      setState("idle");
    };
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
  }

  function handleMicTap() {
    if (state === "speaking") {
      try { window.speechSynthesis.cancel(); } catch {}
      utteranceRef.current = null;
      startListening();
    } else if (state === "listening") {
      stopListening();
      setState("idle");
    } else if (state === "idle" || state === "error") {
      setError(null);
      startListening();
    }
  }

  function handleClose() {
    shouldRestartRef.current = false;
    try { recognitionRef.current?.stop(); } catch {}
    try { window.speechSynthesis.cancel(); } catch {}
    onClose();
  }

  const stateLabel = {
    idle: "Tap the mic when you're ready",
    listening: "Listening…",
    thinking: "Thinking…",
    speaking: "Dex is talking",
    error: error || "Voice not available",
  }[state];

  return (
    <div className="dx-voice" role="dialog" aria-label="Dex voice mode">
      <button
        type="button"
        className="dx-voice-close"
        onClick={handleClose}
        aria-label="Close voice mode"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <div className="dx-voice-stage">
        <div className={`dx-voice-orb is-${state}`}>
          <DexCore />
        </div>

        <div className={`dx-voice-state is-${state}`}>{stateLabel}</div>

        <div className="dx-voice-caption">
          {state === "listening" && transcript && (
            <span className="dx-voice-cap-mine">{transcript}</span>
          )}
          {state === "thinking" && (
            <span className="dx-voice-cap-dim">
              Pulling live data and grading…
            </span>
          )}
          {state === "speaking" && lastReply && (
            <span className="dx-voice-cap-dex">
              {lastReply.length > 240 ? lastReply.slice(0, 240) + "…" : lastReply}
            </span>
          )}
          {state === "error" && error && (
            <span className="dx-voice-cap-err">{error}</span>
          )}
        </div>
      </div>

      <div className="dx-voice-foot">
        <button
          type="button"
          className={`dx-voice-mic is-${state}`}
          onClick={handleMicTap}
          aria-label={state === "listening" ? "Pause" : state === "speaking" ? "Interrupt" : "Talk"}
        >
          {state === "speaking" ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          )}
        </button>
        <div className="dx-voice-help">
          {state === "listening" && "Pause when you stop talking and Dex will reply."}
          {state === "thinking" && "Hang on, pulling the tape."}
          {state === "speaking" && "Tap to interrupt and talk back."}
          {state === "idle" && "Tap the mic, then talk naturally."}
          {state === "error" && "Tap the mic to try again."}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────

function DexCore() {
  // 4 satellites on each ring, computed once so the JSX stays clean.
  const satellites = (radius, count, phase = 0) =>
    Array.from({ length: count }, (_, i) => {
      const a = ((i / count) * 360 + phase) * (Math.PI / 180);
      return { x: 100 + radius * Math.cos(a), y: 100 + radius * Math.sin(a) };
    });

  return (
    <div className="dx-core" aria-hidden="true">
      <div className="dx-core-aura" />
      <div className="dx-core-grid" />

      <svg className="dx-core-ring dx-core-ring-outer" viewBox="0 0 200 200">
        <defs>
          <radialGradient id="dxc-core-grad" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor="#FFE36B" />
            <stop offset="48%" stopColor="#FFD600" />
            <stop offset="100%" stopColor="#5a4900" />
          </radialGradient>
          <linearGradient id="dxc-ring-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,214,0,0.7)" />
            <stop offset="100%" stopColor="rgba(255,214,0,0.05)" />
          </linearGradient>
        </defs>
        <circle
          cx="100" cy="100" r="95"
          fill="none"
          stroke="url(#dxc-ring-gold)"
          strokeWidth="0.6"
          strokeDasharray="2 6"
        />
        {satellites(95, 12).map((p, i) => (
          <circle
            key={i}
            cx={p.x} cy={p.y} r={i % 3 === 0 ? 1.6 : 0.9}
            fill={i % 3 === 0 ? "#FFD600" : "rgba(255,214,0,0.4)"}
          />
        ))}
      </svg>

      <svg className="dx-core-ring dx-core-ring-mid" viewBox="0 0 200 200">
        <circle
          cx="100" cy="100" r="76"
          fill="none"
          stroke="rgba(0, 212, 212, 0.22)"
          strokeWidth="0.8"
        />
        {satellites(76, 4, 45).map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#00D4D4" />
            <circle cx={p.x} cy={p.y} r="9" fill="rgba(0,212,212,0.25)" />
          </g>
        ))}
      </svg>

      <svg className="dx-core-ring dx-core-ring-inner" viewBox="0 0 200 200">
        <circle
          cx="100" cy="100" r="58"
          fill="none"
          stroke="rgba(255, 214, 0, 0.45)"
          strokeWidth="1"
          strokeDasharray="6 4"
        />
        {satellites(58, 6, 15).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.6" fill="rgba(255,214,0,0.85)" />
        ))}
      </svg>

      <svg className="dx-core-center" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="url(#dxc-core-grad)" />
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="0.6" />
        <text
          x="50" y="63"
          textAnchor="middle"
          fontFamily="Bebas Neue, Impact, sans-serif"
          fontSize="50"
          fill="#14151c"
          letterSpacing="2"
        >
          D
        </text>
      </svg>

      <div className="dx-core-particles" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} style={{ "--n": i }} />
        ))}
      </div>
    </div>
  );
}

// Dex's icon glyph — now backed by the user's branded SD-Dark SVG instead
// of the placeholder yellow circle. Used in the bubble avatars and voice
// mode. The header uses the asset directly (see .dx-top-icon) since it
// also renders the wordmark next to it.
function DexGlyph({ small, large, pulsing }) {
  const size = large ? 96 : small ? 28 : 56;
  return (
    <span
      className={`dx-glyph ${pulsing ? "is-pulsing" : ""}`}
      style={{ width: size, height: size }}
    >
      <img
        src="/SD-Dark.svg"
        alt=""
        aria-hidden="true"
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────

const DEX_CSS = `
.dx-app {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: radial-gradient(ellipse at top, #15161e 0%, #0a0b11 70%);
  color: #e3e6ee;
  /* Single font across all of Dex. The user installed Oxanium Variable via
   * @fontsource-variable/oxanium and made it the project's --font-sans in
   * src/index.css; we override the legacy multi-font stack here and let
   * descendants inherit. */
  font-family: 'Oxanium Variable', 'Oxanium', system-ui, sans-serif;
  font-weight: 500;
  overflow: hidden;
  z-index: 100000;
}

/* Subtle scanline / dust feel without competing with chat */
.dx-app::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 18% 12%, rgba(255, 214, 0, 0.06), transparent 35%),
    radial-gradient(circle at 88% 90%, rgba(0, 212, 212, 0.04), transparent 38%);
  pointer-events: none;
}

/* Infinite scrolling grid backdrop (Task 6) — sits behind all chat content */
/* Shared positioning for both grid layers. */
.dx-grid-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.dx-grid-bg svg { width: 100%; height: 100%; display: block; }
/* Dim baseline — masked with a static center radial so the grid fades out
 * near the edges of the viewport (subtle vignette feel). */
.dx-grid-bg-dim {
  opacity: 0.55;
  mask-image: radial-gradient(ellipse at 50% 40%, #000 35%, transparent 80%);
  -webkit-mask-image: radial-gradient(ellipse at 50% 40%, #000 35%, transparent 80%);
}
/* Bright reveal layer — mask is driven inline by JS via useMotionTemplate
 * (cursor-tracking radial gradient). Higher base opacity so the area around
 * the cursor reads as actually brighter than the dim grid. */
.dx-grid-bg-bright {
  opacity: 0.85;
  z-index: 1;
}

.dx-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 0 10px rgba(255, 214, 0, 0.35));
}
.dx-glyph.is-pulsing {
  animation: dx-pulse 1.7s ease-in-out infinite;
}
@keyframes dx-pulse {
  0%, 100% { filter: drop-shadow(0 0 8px rgba(255, 214, 0, 0.3)) brightness(1); transform: scale(1); }
  50%      { filter: drop-shadow(0 0 22px rgba(255, 214, 0, 0.75)) brightness(1.12); transform: scale(1.05); }
}

/* ── Top bar ─────────────────────────────────────────────────────────── */
.dx-top {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  /* Same treatment as the footer: fully transparent wrapper so the page
   * background (and eventually the infinite-grid backdrop) shows through.
   * The DEX logo and the avatar button carry any visual weight themselves. */
  background: transparent;
  z-index: 5;
}
.dx-top-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: inherit;
}
.dx-top-wm {
  font-family: inherit;
  letter-spacing: 0.22em;
  font-size: 19px;
  color: #FFD600;
}
/* SD logo + wordmark in the top-left. Heights tuned so the wordmark visually
 * matches the icon's optical size without making the header taller. */
.dx-top-icon {
  height: 26px;
  width: auto;
  display: block;
}
.dx-top-wm-img {
  height: 22px;
  width: auto;
  display: block;
}
/* Bubble-row identifier — uses the same wordmark for visual consistency
 * with the header. Sized so it reads like a small "Dex:" label next to
 * the response, not a giant logo. */
.dx-bub-wm {
  height: 14px;
  width: auto;
  display: block;
  opacity: 0.85;
}
.dx-bub-wm.is-pulsing {
  animation: dx-wm-pulse 1.4s ease-in-out infinite;
}
@keyframes dx-wm-pulse {
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50%      { opacity: 1;    transform: scale(1.04); }
}

/* Graded response row — full width of the stream container (.dx-stream-in
 * already provides max-width 1280px and centers). Wordmark label sits above
 * the panel so the message is still identified as Dex, without forcing the
 * panel into the narrow .dx-bub-col chat-bubble column. */
.dx-grade-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.dx-grade-label {
  padding-left: 4px;
  display: flex;
  align-items: center;
}

/* Dex tooltip — used for the per-level chip explanations. Plain CSS
 * (not Tailwind) so it doesn't depend on shadcn's dark-mode token
 * activation, which wasn't applying on this page. */
.dx-tooltip {
  max-width: 280px;
  padding: 12px 14px;
  background: rgba(14, 16, 22, 0.97);
  border: 1px solid rgba(255, 214, 0, 0.28);
  border-radius: 10px;
  color: #d9dde8;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.55;
  letter-spacing: 0.01em;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 214, 0, 0.05);
  /* Must beat .dx-app's z-index of 100000 — Radix Portal renders this as a
   * sibling of .dx-app at the document.body level, so a lower z-index gets
   * covered by the entire Dex app shell. */
  z-index: 100001;
  pointer-events: none;
}
/* Anchor-tagged brand still uses the same brand layout as before. */
.dx-top-brand:hover .dx-top-icon,
.dx-top-brand:hover .dx-top-wm-img {
  filter: drop-shadow(0 0 8px rgba(255, 214, 0, 0.35));
}
.dx-top-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  font-family: inherit;
  font-size: 11px;
  color: #8b90a8;
  letter-spacing: 0.06em;
}
.dx-online {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dx-online-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #03CD00;
  box-shadow: 0 0 6px rgba(3, 205, 0, 0.7);
  animation: dx-blink 2.6s ease-in-out infinite;
}
@keyframes dx-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

.dx-top-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #c0c4d2;
  padding: 6px 10px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
}
.dx-top-btn:hover {
  color: #FFD600;
  border-color: rgba(255, 214, 0, 0.35);
  background: rgba(255, 214, 0, 0.05);
}
.dx-top-side {
  color: #5a5e72;
  text-decoration: none;
  letter-spacing: 0.08em;
  font-size: 10.5px;
  transition: color 0.2s;
}
.dx-top-side:hover { color: #FFD600; }

/* Profile avatar button — replaces the legacy "online | By SootyEdge"
 * pair. Just a circular icon button with a soft hover that mirrors the
 * composer's tool buttons. Hooks up to the Profile popup when item 8 lands. */
.dx-top-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #c0c4d2;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s, transform 0.15s;
}
.dx-top-avatar:hover {
  color: #FFD600;
  border-color: rgba(255, 214, 0, 0.45);
  background: rgba(255, 214, 0, 0.08);
  transform: translateY(-1px);
}
.dx-top-avatar:active { transform: translateY(0); }
.dx-top-avatar.is-open {
  color: #FFD600;
  border-color: rgba(255, 214, 0, 0.55);
  background: rgba(255, 214, 0, 0.12);
}

/* Profile popover — anchored top-right under the avatar button. */
.dx-profile-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: transparent; /* invisible — just catches clicks-outside */
}
.dx-profile-pop {
  position: fixed;
  top: 64px;
  right: 18px;
  z-index: 9001;
  width: min(340px, calc(100vw - 36px));
  padding: 18px;
  border-radius: 16px;
  background: rgba(14, 15, 22, 0.92);
  backdrop-filter: blur(28px) saturate(1.5);
  -webkit-backdrop-filter: blur(28px) saturate(1.5);
  border: 1px solid rgba(255, 214, 0, 0.18);
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 214, 0, 0.05);
  color: #d9dde8;
}
.dx-profile-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.dx-profile-ring {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 9999px;
  background: radial-gradient(circle at 35% 30%, rgba(255, 214, 0, 0.28), rgba(255, 214, 0, 0.05));
  border: 1px solid rgba(255, 214, 0, 0.35);
  color: #FFD600;
  flex-shrink: 0;
}
.dx-profile-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dx-profile-name {
  font-size: 14px;
  font-weight: 600;
  color: #f1f3f8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dx-profile-sub {
  font-size: 11px;
  color: #7a7e92;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dx-profile-row { padding: 14px 0 4px; }
.dx-profile-label {
  display: block;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #7a7e92;
  margin-bottom: 6px;
}
.dx-profile-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: #e7eaf4;
  font-family: inherit;
  font-size: 14px;
  padding: 9px 12px;
  border-radius: 10px;
  outline: none;
  transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
}
.dx-profile-input:focus {
  border-color: rgba(255, 214, 0, 0.45);
  background: rgba(255, 214, 0, 0.04);
  box-shadow: 0 0 0 3px rgba(255, 214, 0, 0.08);
}
.dx-profile-hint {
  font-size: 11px;
  color: #5d6177;
  margin-top: 6px;
}
.dx-profile-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 14px 0 8px;
}
.dx-profile-stat {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 8px 10px;
  text-align: center;
}
.dx-profile-stat-n {
  font-size: 18px;
  font-weight: 700;
  color: #FFD600;
  letter-spacing: 0.02em;
}
.dx-profile-stat-l {
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #7a7e92;
  margin-top: 2px;
}
.dx-profile-actions { padding-top: 6px; }
.dx-profile-btn {
  width: 100%;
  background: rgba(255, 51, 51, 0.08);
  color: #ff8a8a;
  border: 1px solid rgba(255, 51, 51, 0.18);
  border-radius: 10px;
  padding: 10px 12px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background 0.18s, color 0.18s, border-color 0.18s;
}
.dx-profile-btn:not(:disabled):hover {
  background: rgba(255, 51, 51, 0.16);
  color: #ffbcbc;
  border-color: rgba(255, 51, 51, 0.35);
}
.dx-profile-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
/* Secondary action — neutral hover, sits above the destructive clear-history
 * button. Used for dev tools like the demo loader. */
.dx-profile-btn-secondary {
  background: rgba(255, 214, 0, 0.06);
  color: #f1f3f8;
  border-color: rgba(255, 214, 0, 0.18);
  margin-bottom: 6px;
}
.dx-profile-btn-secondary:not(:disabled):hover {
  background: rgba(255, 214, 0, 0.13);
  color: #FFD600;
  border-color: rgba(255, 214, 0, 0.45);
}
.dx-profile-foot {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 11px;
  color: #5d6177;
  text-align: center;
}

/* Credit packages section inside the profile popover. */
.dx-profile-section {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}
.dx-profile-section-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #7a7e92;
  margin-bottom: 10px;
}
.dx-profile-section-sub {
  text-transform: none;
  letter-spacing: 0.02em;
  font-size: 10px;
  color: #5d6177;
}
.dx-profile-tiers {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dx-profile-tier {
  width: 100%;
  text-align: left;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 9px 12px;
  cursor: pointer;
  transition: background 0.18s, border-color 0.18s, transform 0.15s;
  color: inherit;
  font-family: inherit;
}
.dx-profile-tier:hover {
  background: rgba(255, 214, 0, 0.05);
  border-color: rgba(255, 214, 0, 0.35);
  transform: translateY(-1px);
}
.dx-profile-tier.is-featured {
  border-color: rgba(255, 214, 0, 0.3);
  background: linear-gradient(180deg, rgba(255, 214, 0, 0.06), rgba(255, 214, 0, 0.02));
}
.dx-tier-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dx-tier-row-end {
  justify-content: space-between;
  margin-top: 2px;
}
.dx-tier-name {
  font-size: 13px;
  font-weight: 600;
  color: #f1f3f8;
}
.dx-tier-badge {
  display: inline-block;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(255, 214, 0, 0.14);
  color: #FFD600;
}
.dx-tier-credits {
  font-size: 12px;
  color: #c0c4d2;
}
.dx-tier-price {
  font-size: 14px;
  font-weight: 700;
  color: #FFD600;
}
.dx-tier-perunit {
  margin-top: 2px;
  font-size: 10px;
  color: #5d6177;
  letter-spacing: 0.02em;
}

/* ── Welcome state ───────────────────────────────────────────────────── */
.dx-welcome {
  flex: 1;
  display: flex;
  /* safe-center keeps the welcome content centered when it fits, but falls
   * back to top-aligned when it doesn't, which prevents the Hey-I-am-Dex
   * headline (and the orb) from being clipped off the top of the viewport
   * on shorter screens. overflow-y auto then lets the user scroll. */
  align-items: safe center;
  justify-content: safe center;
  padding: 36px 24px 48px;
  overflow-y: auto;
  position: relative;
  z-index: 2;
}
.dx-welcome-in {
  max-width: 560px;
  width: 100%;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}
.dx-welcome-avatar { margin-bottom: 8px; }
.dx-welcome-h1 {
  font-family: inherit;
  font-size: 52px;
  letter-spacing: 0.04em;
  color: #FFD600;
  margin: 0;
  text-shadow: 0 0 28px rgba(255, 214, 0, 0.25);
  line-height: 1;
}
.dx-welcome-sub {
  font-size: 17px;
  color: #c0c4d2;
  line-height: 1.55;
  max-width: 480px;
  margin: 0;
}
.dx-welcome-sub em { color: #FFD600; font-style: normal; font-weight: 600; }

/* Wrapper around the greeting lines so AnimatePresence can fade them out
 * as a unit. Inherits the column alignment from .dx-welcome-in. */
.dx-welcome-greeting {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

/* Typewriter caret — sits on the active line while Dex is mid-sentence,
 * disappears as soon as that line finishes typing. Yellow to match the
 * orb / accent palette. */
.dx-caret {
  display: inline-block;
  width: 2px;
  height: 0.9em;
  margin-left: 3px;
  vertical-align: -2px;
  background: #FFD600;
  box-shadow: 0 0 6px rgba(255, 214, 0, 0.55);
  animation: dx-caret-blink 0.75s steps(2) infinite;
}
@keyframes dx-caret-blink {
  0%,  50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.dx-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
}
.dx-chip {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 214, 0, 0.18);
  color: #d8dce8;
  padding: 9px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s, transform 0.15s;
}
.dx-chip:hover {
  background: rgba(255, 214, 0, 0.08);
  border-color: rgba(255, 214, 0, 0.5);
  color: #FFD600;
  transform: translateY(-1px);
}

.dx-welcome-email {
  width: 100%;
  max-width: 340px;
  margin-top: 4px;
}
.dx-welcome-email-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  color: #c4c8d6;
  font-family: inherit;
  text-align: center;
  transition: border-color 0.2s;
}
.dx-welcome-email-input:focus {
  outline: none;
  border-color: rgba(255, 214, 0, 0.5);
}

/* ── Stream / active state ───────────────────────────────────────────── */
.dx-stream {
  flex: 1;
  overflow-y: auto;
  padding: 22px 0;
  position: relative;
  z-index: 2;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 214, 0, 0.2) transparent;
}
.dx-stream::-webkit-scrollbar { width: 8px; }
.dx-stream::-webkit-scrollbar-thumb { background: rgba(255, 214, 0, 0.18); border-radius: 4px; }
.dx-stream-in {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 22px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dx-bub-row {
  display: flex;
  gap: 12px;
  animation: dx-msg-in 0.3s ease both;
}
@keyframes dx-msg-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.dx-bub-row.is-user { flex-direction: row-reverse; }
.dx-bub-avatar { flex-shrink: 0; padding-top: 2px; }
.dx-bub-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: min(78%, 620px);
  min-width: 0;
}
.dx-bub-row.is-user .dx-bub-col { align-items: flex-end; }

.dx-bub {
  padding: 13px 16px;
  border-radius: 16px;
  background: rgba(26, 29, 39, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-bottom-left-radius: 6px;
  font-size: 15px;
  line-height: 1.6;
  color: #e3e6ee;
  word-wrap: break-word;
  font-family: inherit;
}
.dx-bub-row.is-user .dx-bub {
  background: rgba(255, 214, 0, 0.1);
  border-color: rgba(255, 214, 0, 0.3);
  color: #ffe69e;
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 6px;
}
.dx-bub-row.is-error .dx-bub {
  background: rgba(255, 51, 51, 0.08);
  border-color: rgba(255, 51, 51, 0.35);
  color: #f0c8c8;
}
.dx-bub-p { margin: 0; }
.dx-bub-p + .dx-bub-p { margin-top: 10px; }

.dx-typing {
  display: flex;
  gap: 5px;
  align-items: center;
  padding: 14px 18px;
  background: rgba(26, 29, 39, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  border-bottom-left-radius: 6px;
}
.dx-typing span {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: rgba(255, 214, 0, 0.75);
  animation: dx-bounce 1.1s ease-in-out infinite;
}
.dx-typing span:nth-child(2) { animation-delay: 0.15s; }
.dx-typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes dx-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
  30%           { transform: translateY(-5px); opacity: 1; }
}

/* ── Inline grade card ───────────────────────────────────────────────── */
.dx-card {
  background: rgba(8, 10, 16, 0.75);
  border: 1px solid var(--gc, rgba(255, 214, 0, 0.4));
  border-radius: 16px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 6px 28px rgba(0, 0, 0, 0.5);
}
.dx-card-head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.dx-card-grade {
  width: 64px; height: 64px;
  border-radius: 14px;
  border: 2px solid currentColor;
  display: flex; align-items: center; justify-content: center;
  font-family: inherit;
  font-size: 42px; line-height: 1;
  text-shadow: 0 0 18px currentColor;
  background: rgba(0, 0, 0, 0.5);
  flex-shrink: 0;
}
.dx-card-pills { display: flex; flex-wrap: wrap; gap: 6px; flex: 1; min-width: 200px; }
.dx-pill {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 5px 9px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 7px;
}
.dx-pill-l {
  font-family: inherit;
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #8b90a8;
}
.dx-pill-v {
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
}

.dx-card-lvls { display: flex; flex-direction: column; gap: 7px; }
.dx-lvl {
  display: grid;
  grid-template-columns: 64px 78px 1fr;
  align-items: center;
  gap: 10px;
  padding: 8px 11px;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.04);
}
.dx-lvl-tag {
  font-family: inherit;
  font-size: 12px;
  letter-spacing: 0.1em;
  padding: 3px 8px;
  border: 1px solid currentColor;
  border-radius: 5px;
  text-align: center;
}
.dx-lvl-px {
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
}
.dx-lvl-r { color: #b6bac9; font-size: 12.5px; line-height: 1.5; }

.dx-block {
  padding: 11px 14px;
  background: rgba(0, 0, 0, 0.3);
  border-left: 3px solid var(--bc, #FFD600);
  border-radius: 8px;
}
.dx-block.is-alert {
  background: rgba(255, 51, 51, 0.07);
}
.dx-block-t {
  font-family: inherit;
  font-size: 12px;
  letter-spacing: 0.14em;
  color: var(--bc, #FFD600);
  margin-bottom: 4px;
}
.dx-block-b {
  margin: 0;
  color: #d8dce8;
  font-size: 13.5px;
  line-height: 1.55;
}

/* ── Input bar ───────────────────────────────────────────────────────── */
.dx-foot {
  position: relative;
  padding: 16px 22px 20px;
  /* Wrapper is transparent so the page background (or the infinite-grid /
   * particles behind it) shows through. The composer shell itself
   * (.dx-composer-shell in DexChatComposer.jsx) carries the glass effect. */
  background: transparent;
  z-index: 5;
}
.dx-input-wrap {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  align-items: flex-end;
  gap: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 214, 0, 0.2);
  border-radius: 14px;
  padding: 8px 8px 8px 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.dx-input-wrap:focus-within {
  border-color: rgba(255, 214, 0, 0.6);
  box-shadow: 0 0 0 3px rgba(255, 214, 0, 0.08);
}
.dx-textarea {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #e3e6ee;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.5;
  resize: none;
  padding: 8px 0;
  max-height: 160px;
}
.dx-textarea::placeholder { color: #6a6e80; }
.dx-textarea:disabled { opacity: 0.6; }
.dx-send {
  background: linear-gradient(135deg, #FFD600, #E0BA00);
  color: #14151c;
  border: none;
  width: 40px; height: 40px;
  border-radius: 11px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
  box-shadow: 0 4px 16px rgba(255, 214, 0, 0.3);
}
.dx-send:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  box-shadow: none;
}
.dx-send:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 22px rgba(255, 214, 0, 0.45);
}
.dx-mic {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 214, 0, 0.25);
  color: #FFD600;
  width: 40px; height: 40px;
  border-radius: 11px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s, transform 0.15s, opacity 0.15s;
}
.dx-mic:disabled { opacity: 0.4; cursor: not-allowed; }
.dx-mic:not(:disabled):hover {
  background: rgba(255, 214, 0, 0.08);
  border-color: rgba(255, 214, 0, 0.55);
  transform: translateY(-1px);
}

/* ── Composer (new chat input — adapted from animated-ai-chat) ────────── */
.dx-composer {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.025);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  box-shadow: 0 14px 44px rgba(0, 0, 0, 0.36);
  transition: border-color 0.25s, box-shadow 0.25s;
}
.dx-composer:focus-within {
  border-color: rgba(255, 214, 0, 0.4);
  box-shadow: 0 14px 50px rgba(0, 0, 0, 0.42), 0 0 0 1px rgba(255, 214, 0, 0.14);
}
.dx-composer-ta {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  color: #e3e6ee;
  font-family: inherit;
  font-size: 16px;
  line-height: 1.55;
  padding: 16px 18px 6px;
  max-height: 160px;
  box-sizing: border-box;
}
.dx-composer-ta::placeholder { color: #5a5e72; }
.dx-composer-ta:disabled { opacity: 0.6; }
.dx-composer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px 10px;
}
.dx-composer-tools { display: flex; align-items: center; gap: 4px; }
.dx-composer-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px;
  border-radius: 10px;
  background: transparent;
  border: none;
  color: #8b90a8;
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
}
.dx-composer-btn:not(:disabled):hover { color: #FFD600; background: rgba(255, 214, 0, 0.08); }
.dx-composer-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.dx-composer-send {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 16px;
  border-radius: 12px;
  border: none;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  background: rgba(255, 255, 255, 0.06);
  color: #5a5e72;
  cursor: not-allowed;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s, transform 0.15s;
}
.dx-composer-send.is-ready {
  background: linear-gradient(135deg, #FFD600, #E0BA00);
  color: #14151c;
  cursor: pointer;
  box-shadow: 0 4px 18px rgba(255, 214, 0, 0.28);
}
.dx-composer-send.is-ready:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 26px rgba(255, 214, 0, 0.42);
}

/* ── New composer (DexChatComposer.jsx) ───────────────────────────────── */
.dx-composer-wrap {
  position: relative;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
}
/* Cursor-tracking diffuse glow behind the input on focus. Pulled from the
 * animated-ai-chat reference but tinted Dex yellow and lower opacity so it
 * doesn't compete with the orb. */
.dx-composer-aura {
  position: fixed;
  pointer-events: none;
  width: 50rem;
  height: 50rem;
  border-radius: 9999px;
  opacity: 0.04;
  background: radial-gradient(circle, rgba(255, 214, 0, 0.7), rgba(255, 232, 148, 0.25) 40%, transparent 70%);
  filter: blur(96px);
  z-index: 0;
}
.dx-composer-shell {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.018);
  backdrop-filter: blur(32px) saturate(1.4);
  -webkit-backdrop-filter: blur(32px) saturate(1.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 18px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
  transition: border-color 0.25s, box-shadow 0.25s;
}
.dx-composer-shell:focus-within {
  border-color: rgba(255, 214, 0, 0.35);
  box-shadow: 0 18px 56px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 214, 0, 0.18);
}
.dx-composer-pad { padding: 16px 18px 4px; }
.dx-composer-ta-new {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  color: rgba(231, 234, 244, 0.92);
  font-family: inherit;
  font-size: 15px;
  line-height: 1.55;
  padding: 4px 0;
  min-height: 60px;
  box-sizing: border-box;
}
.dx-composer-ta-new::placeholder { color: rgba(231, 234, 244, 0.22); }
.dx-composer-ta-new:disabled { opacity: 0.55; }
.dx-composer-attach {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 18px 10px;
}
.dx-composer-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(231, 234, 244, 0.72);
  font-family: inherit;
  font-size: 11px;
}
.dx-composer-chip-x {
  display: inline-flex;
  background: transparent;
  border: none;
  color: rgba(231, 234, 244, 0.45);
  cursor: pointer;
  padding: 0;
}
.dx-composer-chip-x:hover { color: rgba(231, 234, 244, 0.9); }
.dx-composer-row-new {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 12px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}
.dx-composer-tools-new {
  display: flex;
  align-items: center;
  gap: 4px;
}
.dx-composer-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: transparent;
  border: none;
  color: rgba(231, 234, 244, 0.42);
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
}
.dx-composer-tool:not(:disabled):hover {
  color: #FFD600;
  background: rgba(255, 214, 0, 0.08);
}
.dx-composer-tool:disabled { opacity: 0.35; cursor: not-allowed; }
.dx-composer-send-new {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 16px;
  border-radius: 10px;
  border: none;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(231, 234, 244, 0.45);
  cursor: not-allowed;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s, transform 0.15s;
}
.dx-composer-send-new.is-ready {
  background: linear-gradient(135deg, #FFD600, #E0BA00);
  color: #14151c;
  cursor: pointer;
  box-shadow: 0 4px 18px rgba(255, 214, 0, 0.28);
}
.dx-composer-send-new.is-ready:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 26px rgba(255, 214, 0, 0.42);
}
.dx-composer-send-new:disabled { transform: none; }
.dx-spin { animation: dx-rotate 1.2s linear infinite; }
@keyframes dx-rotate {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* Suggestion pills below the composer shell — same look as the
 * reference design's "Clone UI / Import Figma / Create Page / Improve"
 * row, but populated with Dex's SUGGESTED_PROMPTS. */
.dx-composer-suggest {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 14px;
}
.dx-composer-suggest-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: rgba(231, 234, 244, 0.62);
  font-size: 13px;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s, transform 0.15s;
}
.dx-composer-suggest-btn:not(:disabled):hover {
  color: #FFD600;
  border-color: rgba(255, 214, 0, 0.25);
  background: rgba(255, 214, 0, 0.04);
}
.dx-composer-suggest-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── Voice mode overlay ─────────────────────────────────────────────── */
.dx-voice {
  position: fixed;
  inset: 0;
  z-index: 200000;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at 50% 36%, rgba(255, 214, 0, 0.08), transparent 55%),
    radial-gradient(ellipse at top, #131420 0%, #06070d 80%);
  animation: dx-voice-in 0.32s ease;
  font-family: inherit;
}
@keyframes dx-voice-in {
  from { opacity: 0; transform: scale(0.98); }
  to   { opacity: 1; transform: scale(1); }
}
.dx-voice-close {
  position: absolute;
  top: 18px;
  right: 18px;
  width: 38px; height: 38px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #c0c4d2;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: color 0.2s, background 0.2s, border-color 0.2s;
  z-index: 2;
}
.dx-voice-close:hover {
  color: #FFD600;
  background: rgba(255, 214, 0, 0.08);
  border-color: rgba(255, 214, 0, 0.4);
}

.dx-voice-stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 28px 16px;
  text-align: center;
  gap: 28px;
}

.dx-voice-orb {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dx-voice-orb.is-thinking { animation: dx-think-pulse 1.8s ease-in-out infinite; }
.dx-voice-orb.is-speaking { animation: dx-think-pulse 1.0s ease-in-out infinite; }
@keyframes dx-think-pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.04); }
}

.dx-voice-state {
  font-family: inherit;
  font-size: 26px;
  letter-spacing: 0.16em;
  color: #FFD600;
  text-shadow: 0 0 20px rgba(255, 214, 0, 0.3);
  min-height: 30px;
}
.dx-voice-state.is-listening { color: #FFD600; }
.dx-voice-state.is-thinking { color: #E0BA00; }
.dx-voice-state.is-speaking { color: #03CD00; text-shadow: 0 0 20px rgba(3, 205, 0, 0.4); }
.dx-voice-state.is-error    { color: #FF6666; text-shadow: none; }

.dx-voice-caption {
  max-width: 560px;
  min-height: 80px;
  padding: 0 16px;
  font-size: 17px;
  line-height: 1.55;
  color: #c8ccdb;
}
.dx-voice-cap-mine { color: #ffe69e; font-style: italic; }
.dx-voice-cap-dex  { color: #d8dce8; }
.dx-voice-cap-dim  { color: #7a7e92; font-family: inherit; font-size: 14px; letter-spacing: 0.06em; }
.dx-voice-cap-err  { color: #f0c8c8; }

.dx-voice-foot {
  padding: 0 28px 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.dx-voice-mic {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 2px solid rgba(255, 214, 0, 0.5);
  background: radial-gradient(circle at 30% 30%, #FFE36B, #E0BA00);
  color: #14151c;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow:
    0 12px 32px rgba(255, 214, 0, 0.35),
    inset 0 -4px 12px rgba(0, 0, 0, 0.2);
  transition: transform 0.15s, box-shadow 0.15s;
}
.dx-voice-mic:hover { transform: translateY(-2px); }
.dx-voice-mic.is-listening {
  background: radial-gradient(circle at 30% 30%, #FF6666, #C44);
  border-color: rgba(255, 80, 80, 0.6);
  box-shadow:
    0 12px 32px rgba(255, 80, 80, 0.4),
    inset 0 -4px 12px rgba(0, 0, 0, 0.2);
  animation: dx-mic-pulse 1.4s ease-in-out infinite;
  color: #fff;
}
@keyframes dx-mic-pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.06); }
}
.dx-voice-mic.is-thinking {
  background: radial-gradient(circle at 30% 30%, #555, #2a2c38);
  border-color: rgba(255, 255, 255, 0.1);
  color: #FFD600;
  cursor: default;
}
.dx-voice-mic.is-speaking {
  background: radial-gradient(circle at 30% 30%, #06E806, #038f03);
  border-color: rgba(3, 205, 0, 0.5);
  color: #fff;
  box-shadow: 0 12px 32px rgba(3, 205, 0, 0.4), inset 0 -4px 12px rgba(0,0,0,0.2);
}
.dx-voice-mic.is-error {
  background: radial-gradient(circle at 30% 30%, #3a3a3a, #1f1f1f);
  border-color: rgba(255, 102, 102, 0.4);
  color: #FF6666;
}
.dx-voice-help {
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: #7a7e92;
  text-align: center;
  max-width: 440px;
}

@media (max-width: 540px) {
  .dx-voice-orb { width: 180px; height: 180px; }
  .dx-voice-core { width: 110px; height: 110px; }
  .dx-voice-state { font-size: 22px; }
  .dx-voice-caption { font-size: 15.5px; }
  .dx-voice-mic { width: 72px; height: 72px; }
}
.dx-foot-hint {
  max-width: 760px;
  margin: 10px auto 0;
  font-family: inherit;
  font-size: 10.5px;
  color: #5a5e72;
  letter-spacing: 0.06em;
  text-align: center;
}
.dx-beta {
  color: #FFD600;
  font-weight: 600;
  letter-spacing: 0.16em;
}

/* ── Dex Core (welcome hero) ─────────────────────────────────────────── */
.dx-welcome-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}
.dx-welcome-tag {
  color: #FFD600;
  text-shadow: 0 0 12px rgba(255, 214, 0, 0.4);
}
.dx-welcome-tag-dim {
  color: #7a7e92;
}
.dx-welcome-sep {
  width: 32px;
  height: 1px;
  background: linear-gradient(90deg, rgba(255, 214, 0, 0.5), rgba(0, 212, 212, 0.3));
}

.dx-welcome-avatar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 8px 0 4px;
}
.dx-core {
  position: relative;
  width: 260px;
  height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dx-core-aura {
  position: absolute;
  inset: -30px;
  background:
    radial-gradient(circle at 50% 50%, rgba(255, 214, 0, 0.28), transparent 55%),
    radial-gradient(circle at 30% 70%, rgba(0, 212, 212, 0.16), transparent 60%);
  filter: blur(8px);
  pointer-events: none;
  animation: dxc-aura 5s ease-in-out infinite;
}
@keyframes dxc-aura {
  0%, 100% { opacity: 0.85; transform: scale(1); }
  50%      { opacity: 1; transform: scale(1.05); }
}
.dx-core-grid {
  position: absolute;
  inset: 4%;
  border-radius: 50%;
  background:
    repeating-linear-gradient(0deg, transparent, transparent 14px, rgba(255, 214, 0, 0.035) 14px, rgba(255, 214, 0, 0.035) 15px),
    repeating-linear-gradient(90deg, transparent, transparent 14px, rgba(0, 212, 212, 0.03) 14px, rgba(0, 212, 212, 0.03) 15px);
  mask: radial-gradient(circle at center, black 55%, transparent 75%);
  -webkit-mask: radial-gradient(circle at center, black 55%, transparent 75%);
  opacity: 0.6;
  pointer-events: none;
}

.dx-core-ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform-origin: center;
}
.dx-core-ring-outer { animation: dxc-spin 64s linear infinite; }
.dx-core-ring-mid   { animation: dxc-spin 38s linear infinite reverse; }
.dx-core-ring-inner { animation: dxc-spin 22s linear infinite; }
@keyframes dxc-spin {
  to { transform: rotate(360deg); }
}

.dx-core-center {
  position: relative;
  z-index: 3;
  width: 120px;
  height: 120px;
  filter:
    drop-shadow(0 0 18px rgba(255, 214, 0, 0.55))
    drop-shadow(0 0 40px rgba(255, 214, 0, 0.28));
  animation: dxc-breathe 3.4s ease-in-out infinite;
}
@keyframes dxc-breathe {
  0%, 100% { transform: scale(1); filter: drop-shadow(0 0 18px rgba(255, 214, 0, 0.55)) drop-shadow(0 0 40px rgba(255, 214, 0, 0.28)); }
  50%      { transform: scale(1.04); filter: drop-shadow(0 0 28px rgba(255, 214, 0, 0.75)) drop-shadow(0 0 64px rgba(255, 214, 0, 0.4)); }
}

.dx-core-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 4;
}
.dx-core-particles span {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #FFD600;
  box-shadow: 0 0 6px rgba(255, 214, 0, 0.6);
  opacity: 0;
  animation: dxc-drift 7s linear infinite;
  animation-delay: calc(var(--n) * -0.5s);
  --angle: calc(var(--n) * 25.7deg);
}
.dx-core-particles span:nth-child(3n)   { background: #00D4D4; box-shadow: 0 0 6px rgba(0, 212, 212, 0.6); }
.dx-core-particles span:nth-child(5n+1) { width: 2px; height: 2px; }
@keyframes dxc-drift {
  0%   { opacity: 0; transform: rotate(var(--angle)) translateX(50px) rotate(calc(var(--angle) * -1)); }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { opacity: 0; transform: rotate(var(--angle)) translateX(165px) rotate(calc(var(--angle) * -1)); }
}

/* ── Grade card (rebuilt) ────────────────────────────────────────────── */
.dx-card {
  background: linear-gradient(180deg, rgba(14, 16, 22, 0.92), rgba(8, 10, 16, 0.95));
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  padding: 0;
  overflow: hidden;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
}

/* Hero zone */
.dx-card-hero {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 22px;
  align-items: center;
  padding: 22px 22px 20px;
  background: linear-gradient(135deg, rgba(255, 214, 0, 0.06), rgba(0, 212, 212, 0.03));
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.dx-card-letter {
  position: relative;
  width: 96px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.dx-card-letter-glow {
  display: none;
}
.dx-card-letter-ring {
  position: absolute;
  inset: 0;
  border: 1.5px solid var(--gc, #FFD600);
  border-radius: 18px;
  background: rgba(0, 0, 0, 0.55);
  box-shadow: inset 0 0 24px rgba(0, 0, 0, 0.4);
}
.dx-card-letter-text {
  position: relative;
  z-index: 2;
  font-family: inherit;
  font-size: 64px;
  line-height: 1;
  color: var(--gc, #FFD600);
  letter-spacing: 0;
}

.dx-card-meta { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.dx-card-symbol-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.dx-card-symbol {
  font-family: inherit;
  font-size: 30px;
  letter-spacing: 0.06em;
  color: #FFD600;
  line-height: 1;
}
.dx-card-tf {
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #8b90a8;
  padding: 3px 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.02);
}
.dx-card-stats { display: flex; flex-wrap: wrap; gap: 6px; }
.dx-card-stat {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 9px 14px;
  /* Solid mid-gray tile clearly distinct from the .dx-tp-head bg (#20232e).
   * 1px crisp border for definition, no glass / glow. */
  background: #2a2e3c;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
}
.dx-card-stat-l {
  font-family: inherit;
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #6c708a;
}
.dx-card-stat-v {
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: capitalize;
}

/* ── Trade Terminal Panel (graded messages) ────────────────────────── */
/* Solid lighter-gray dashboard. No backdrop blur (the liquid-glass attempt
 * read as muddy on the dark page bg). Hierarchy comes from a step-up gray
 * scale (page → panel → inner sections → tiles) plus crisp 1–2px borders
 * to draw clean separations. */
.dx-tp {
  width: 100%;
  background: #1a1d27;
  border: 1px solid rgba(255, 214, 0, 0.22);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
  animation: dx-msg-in 0.32s ease both;
}

.dx-tp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px;
  background: #20232e;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  flex-wrap: wrap;
}
.dx-tp-id { display: flex; align-items: center; gap: 14px; min-width: 0; }
.dx-tp-badge { flex-shrink: 0; }

/* Modern grade badge — solid dark tile, color-coded border + letter.
 * Matches the rest of the dashboard's flat-gray + bright-border treatment.
 * --gc is the grade color (yellow A, cyan B, etc.) passed via inline style. */
.dx-grade-badge {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  background: #272b39;
  border: 2px solid var(--gc, #FFD600);
  border-radius: 14px;
  position: relative;
  overflow: hidden;
  font-family: inherit;
}
.dx-grade-eyebrow {
  font-size: 9px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: #7a7e92;
  margin-top: 2px;
  font-weight: 600;
}
.dx-grade-letter {
  font-size: 46px;
  font-weight: 800;
  color: var(--gc, #FFD600);
  line-height: 1;
  letter-spacing: -0.02em;
  /* Tiny inner glow on the letter only — no shadow on the tile itself,
   * keeps the modern flat feel while still giving the grade some punch. */
  text-shadow: 0 0 18px color-mix(in srgb, var(--gc, #FFD600) 35%, transparent);
}
.dx-grade-bar {
  position: absolute;
  bottom: 0;
  left: 12%;
  right: 12%;
  height: 3px;
  border-radius: 2px 2px 0 0;
  background: var(--gc, #FFD600);
  opacity: 0.85;
}
.dx-tp-id-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.dx-tp-ticker {
  font-family: inherit;
  font-size: 24px;
  letter-spacing: 0.06em;
  color: #FFFFFF;
  line-height: 1;
}
.dx-tp-sub {
  font-family: inherit;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  color: #FFFFFF;
  text-transform: capitalize;
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.dx-tp-sub-sep { color: #4a4d5e; }
.dx-tp-stats { display: flex; gap: 6px; flex-wrap: wrap; }

.dx-tp-main {
  display: grid;
  grid-template-columns: minmax(280px, 360px) 1fr;
  gap: 0;
}
.dx-tp-left {
  padding: 18px 20px 22px;
  border-right: 1px solid rgba(255, 255, 255, 0.12);
  /* Solid step lighter than the panel base (#1a1d27 → #1f2330). */
  background: #1f2330;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 360px;
}
.dx-tp-section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: inherit;
  font-size: 11.5px;
  letter-spacing: 0.22em;
  color: #6c708a;
  text-transform: uppercase;
}
.dx-tp-narrative {
  font-size: 14px;
  line-height: 1.65;
  color: #d8dce8;
  overflow-y: auto;
  max-height: 420px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 214, 0, 0.18) transparent;
}
.dx-tp-narrative::-webkit-scrollbar { width: 5px; }
.dx-tp-narrative::-webkit-scrollbar-thumb { background: rgba(255, 214, 0, 0.18); border-radius: 3px; }
.dx-tp-narrative p { margin: 0 0 10px 0; }
.dx-tp-narrative p:last-child { margin-bottom: 0; }

.dx-tp-right {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.dx-tp-chart {
  flex: 1;
  padding: 14px 14px 4px;
  display: flex;
  flex-direction: column;
}
.dx-tp-chart .dx-card-chart-wrap {
  padding: 0;
  background: transparent;
  border-bottom: none;
}
.dx-tp-chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 280px;
  color: #6c708a;
  font-family: inherit;
  font-size: 12px;
}
.dx-tp-strip {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  background: transparent;
  border-top: none;
  padding: 8px 14px 16px;
}
.dx-tp-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  /* Solid mid-gray fill + crisp 2px colored border. No glow, no gradient.
   * The level identity (Entry yellow, Stop red, TPs green) lives in the
   * border + text only. */
  background: #272b39;
  border: 2px solid var(--cc, #FFD600);
  border-radius: 10px;
  transition: background 0.18s, transform 0.15s;
}
.dx-tp-chip:hover {
  background: #2e3243;
  transform: translateY(-1px);
}
.dx-tp-chip-l {
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--cc, #FFD600);
  text-transform: uppercase;
}
.dx-tp-chip-v {
  font-family: inherit;
  font-size: 18px;
  font-weight: 600;
  color: var(--cc, #FFD600);
  line-height: 1.1;
}

.dx-tp-bottom {
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  background: #1f2330;
}
.dx-tp-bottom .dx-card-section { padding: 32px 22px 14px; }
.dx-tp-bottom .dx-card-insights { padding: 18px 22px 10px; }
.dx-tp-bottom .dx-card-foot { padding: 14px 22px 18px; background: transparent; }

@media (max-width: 900px) {
  .dx-tp-main { grid-template-columns: 1fr; }
  .dx-tp-left {
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    min-height: 0;
  }
  .dx-tp-narrative { max-height: 220px; }
  .dx-tp-chip-v { font-size: 15px; }
  .dx-tp-strip { grid-template-columns: repeat(5, 1fr); }
}
@media (max-width: 540px) {
  .dx-tp-head { padding: 12px 14px; gap: 12px; }
  .dx-tp-letter { width: 44px; height: 44px; border-radius: 10px; }
  .dx-tp-letter-text { font-size: 28px; }
  .dx-tp-ticker { font-size: 20px; }
  .dx-tp-left { padding: 14px; }
  .dx-tp-chart { padding: 10px 10px 2px; }
  .dx-tp-chip { padding: 10px 4px; }
  .dx-tp-chip-l { font-size: 9px; letter-spacing: 0.12em; }
  .dx-tp-chip-v { font-size: 13px; }
  .dx-tp-bottom .dx-card-section { padding: 14px 16px 8px; }
  .dx-tp-bottom .dx-card-insights { padding: 4px 16px 6px; }
  .dx-tp-bottom .dx-card-foot { padding: 10px 16px 14px; }
}

/* Inline chart */
.dx-card-chart-wrap {
  padding: 14px 18px 16px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.25));
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.dx-card-chart-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 0 2px;
}
.dx-card-chart-label {
  font-family: inherit;
  font-size: 12px;
  letter-spacing: 0.22em;
  color: #6c708a;
  text-transform: uppercase;
}
.dx-card-chart-tf {
  font-family: inherit;
  font-size: 10px;
  letter-spacing: 0.1em;
  color: #5a5e72;
}
.dx-card-chart {
  width: 100%;
  height: 260px;
  border-radius: 8px;
  overflow: hidden;
}

/* Section */
.dx-card-section { padding: 28px 22px 14px; }
.dx-card-section-label {
  font-family: inherit;
  font-size: 11.5px;
  letter-spacing: 0.22em;
  color: #6c708a;
  margin-bottom: 18px;
}

/* Levels */
.dx-card-lvls { display: flex; flex-direction: column; gap: 8px; }
.dx-card-lvl {
  position: relative;
  display: grid;
  grid-template-columns: 4px 110px 1fr;
  gap: 16px;
  align-items: center;
  padding: 14px 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.02));
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 10px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
}
.dx-card-lvl:hover {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.025));
  border-color: rgba(255, 255, 255, 0.16);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.085),
    0 2px 8px rgba(0, 0, 0, 0.2);
}
.dx-card-lvl-bar {
  align-self: stretch;
  background: var(--lc, #FFD600);
  border-radius: 3px;
}
.dx-card-lvl-mark {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.dx-card-lvl-label {
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--lc, #FFD600);
  text-transform: uppercase;
}
.dx-card-lvl-price {
  font-family: inherit;
  font-size: 18px;
  font-weight: 600;
  color: var(--lc, #FFD600);
  line-height: 1.1;
}
.dx-card-lvl-reason {
  margin: 0;
  color: #c4c8d6;
  font-size: 13px;
  line-height: 1.55;
}

/* Insights — UNLOCKED-style pill label inside a panel card */
.dx-card-insights {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 22px 8px;
}
.dx-card-insight {
  padding: 14px 18px 16px;
  /* Solid raised tile, lighter than the .dx-tp-bottom (#1f2330) so it
   * reads as a step up. Crisp colored border in the insight color (via
   * --ic) makes the section identifiable at a glance. */
  background: #272b39;
  border: 1px solid color-mix(in srgb, var(--ic, #FFD600) 38%, rgba(255, 255, 255, 0.10));
  border-radius: 10px;
}
.dx-card-insight.is-alert {
  background: #272b39;
  border-color: rgba(255, 51, 51, 0.45);
}
.dx-card-insight-head {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid color-mix(in srgb, var(--ic, #FFD600) 35%, transparent);
  border-radius: 6px;
  margin-bottom: 10px;
}
.dx-card-insight-bar {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ic, #FFD600);
  box-shadow: none;
}
.dx-card-insight.is-alert .dx-card-insight-head {
  border-color: rgba(255, 51, 51, 0.45);
}
.dx-card-insight.is-alert .dx-card-insight-bar {
  background: #FF3333;
}
.dx-card-insight-title {
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--ic, #FFD600);
  text-transform: uppercase;
  line-height: 1;
}
.dx-card-insight.is-alert .dx-card-insight-title { color: #FF6666; }
.dx-card-insight-body {
  margin: 0;
  color: #d8dce8;
  font-size: 13.5px;
  line-height: 1.65;
}

.dx-card-foot {
  padding: 12px 22px 16px;
  font-family: inherit;
  font-size: 10px;
  letter-spacing: 0.1em;
  color: #5a5e72;
  text-align: center;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  background: rgba(0, 0, 0, 0.2);
}

/* ── Mobile ──────────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .dx-top { padding: 12px 16px; }
  .dx-top-side { display: none; }
  .dx-welcome-h1 { font-size: 40px; }
  .dx-welcome-sub { font-size: 15px; }
  .dx-stream-in { padding: 0 14px; }
  .dx-bub-col { max-width: 88%; }
  .dx-foot { padding: 12px 14px 16px; }
  .dx-input-wrap { padding: 6px 6px 6px 12px; }

  .dx-core { width: 220px; height: 220px; }
  .dx-core-center { width: 96px; height: 96px; }

  .dx-card-hero { padding: 18px 16px 14px; gap: 14px; grid-template-columns: 76px 1fr; }
  .dx-card-letter { width: 76px; height: 76px; }
  .dx-card-letter-text { font-size: 50px; }
  .dx-card-symbol { font-size: 24px; }
  .dx-card-chart-wrap { padding: 10px 14px 12px; }
  .dx-card-chart { height: 220px; }
  .dx-card-section { padding: 14px 16px 12px; }
  .dx-card-insights { padding: 0 14px 4px; }
  .dx-card-lvl { grid-template-columns: 3px 86px 1fr; gap: 10px; padding: 10px 12px; }
  .dx-card-lvl-price { font-size: 16px; }
  .dx-card-lvl-reason { grid-column: 1 / -1; padding-left: 100px; }
  .dx-card-foot { padding: 10px 14px 12px; }
}
`;
