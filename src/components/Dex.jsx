// Dex: standalone AI Trading Mentor product. Full-screen chat experience at
// /dex (production: tradegrader.live). NOT a widget on the marketing site;
// this IS the product.
//
// Backend: /api/dex/chat (multi-turn conversation with Anthropic tool-use).

import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, CandlestickSeries, LineStyle } from "lightweight-charts";
import { chatWithDex } from "../lib/dex-api";

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
  "Grade NVDA on the 1h",
  "What's the play on TSLA right now?",
  "Walk me through how you grade a breakout",
  "I'm watching SOFI, pull the chart",
];

export default function Dex() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [email, setEmail] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

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

  function reset() {
    setMessages([]);
    setSessionId(null);
    try {
      localStorage.removeItem(STORAGE_KEY_SESSION);
      localStorage.removeItem(STORAGE_KEY_HISTORY);
    } catch {}
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
    <div className="dx-app">
      <style>{DEX_CSS}</style>

      <header className="dx-top">
        <div className="dx-top-brand">
          <DexGlyph small />
          <span className="dx-top-wm">Dex</span>
        </div>
        <div className="dx-top-meta">
          <span className="dx-online">
            <span className="dx-online-dot" />
            online
          </span>
          {messages.length > 0 && (
            <button type="button" className="dx-top-btn" onClick={reset} title="New conversation">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              New chat
            </button>
          )}
          <a href="/" className="dx-top-side">By SootyEdge</a>
        </div>
      </header>

      {empty ? (
        <Welcome onPick={(p) => send(p)} email={email} onEmail={saveEmail} />
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
        <div className="dx-input-wrap">
          <textarea
            ref={textareaRef}
            className="dx-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              sending
                ? "Dex is reading the chart…"
                : empty
                ? "Drop a ticker, paste a setup, or ask anything…"
                : "Ask a follow-up, or try another ticker…"
            }
            rows={1}
            disabled={sending}
            maxLength={2000}
          />
          <button
            type="button"
            className="dx-mic"
            onClick={() => setVoiceOpen(true)}
            disabled={sending}
            aria-label="Voice mode"
            title="Voice mode"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          </button>
          <button
            type="button"
            className="dx-send"
            onClick={() => send()}
            disabled={!input.trim() || sending}
            aria-label="Send"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
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
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────

function Welcome({ onPick, email, onEmail }) {
  return (
    <main className="dx-welcome">
      <div className="dx-welcome-in">
        <div className="dx-welcome-eyebrow">
          <span className="dx-welcome-tag">TradeGrader</span>
          <span className="dx-welcome-sep" />
          <span className="dx-welcome-tag-dim">AI Trading Mentor</span>
        </div>
        <div className="dx-welcome-avatar">
          <DexCore />
        </div>
        <h1 className="dx-welcome-h1">Hey, I'm Dex.</h1>
        <p className="dx-welcome-sub">
          Your AI Trading Mentor. Drop a ticker, paste a setup, or ask anything.
          I pull live data, run the technicals, and grade the play <em>A through F</em>.
        </p>
        <div className="dx-chips">
          {SUGGESTED_PROMPTS.map((p, i) => (
            <button key={i} type="button" className="dx-chip" onClick={() => onPick(p)}>
              {p}
            </button>
          ))}
        </div>
        <div className="dx-welcome-email">
          <input
            type="email"
            className="dx-welcome-email-input"
            placeholder="email (optional, saves your grades & history)"
            defaultValue={email}
            onBlur={(e) => onEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onEmail(e.target.value);
              }
            }}
          />
        </div>
      </div>
    </main>
  );
}

function Bubble({ msg }) {
  // Graded message gets the full trade-terminal panel (breaks out of the
  // narrow chat column). Otherwise, normal bubble.
  if (msg.role === "assistant" && msg.grade) {
    return <TradePanel grade={msg.grade} text={msg.content} />;
  }

  const isUser = msg.role === "user";
  return (
    <div className={`dx-bub-row ${isUser ? "is-user" : "is-bot"}${msg.isError ? " is-error" : ""}`}>
      {!isUser && (
        <div className="dx-bub-avatar">
          <DexGlyph small />
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
            <DexGlyph small />
            <span>Dex's breakdown</span>
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
            <LevelChip label="Entry" price={grade.entry} color="#FFD600" />
            <LevelChip label="Stop" price={grade.stop_loss} color="#FF3333" />
            <LevelChip label="TP1" price={grade.tp1} color="#03CD00" />
            <LevelChip label="TP2" price={grade.tp2} color="#03CD00" />
            <LevelChip label="TP3" price={grade.tp3} color="#03CD00" />
          </div>
        </section>
      </div>

      <div className="dx-tp-bottom">
        <div className="dx-card-section" style={{ paddingTop: 0 }}>
          <div className="dx-card-section-label">Trade plan</div>
          <div className="dx-card-lvls">
            <LvlRow label="Entry" price={grade.entry} reason={grade.entry_reason} color="#FFD600" />
            <LvlRow label="Stop" price={grade.stop_loss} reason={grade.stop_reason} color="#FF3333" />
            <LvlRow label="TP1" price={grade.tp1} reason={grade.tp1_reason} color="#03CD00" />
            <LvlRow label="TP2" price={grade.tp2} reason={grade.tp2_reason} color="#03CD00" />
            <LvlRow label="TP3" price={grade.tp3} reason={grade.tp3_reason} color="#03CD00" />
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
    </div>
  );
}

function GradeBadge({ letter, color, size = 80 }) {
  // Circular grading stamp: scalloped outer ring + gold-gradient inner disc +
  // letter centered. Replaces the square pill so the grade reads as a real
  // graded "seal" instead of a CSS button.
  const teeth = 18;
  const points = useMemo(() => {
    const out = [];
    const outerR = 48;
    const innerR = 45;
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      out.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`);
    }
    return out.join(" ");
  }, [teeth]);

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="dx-tp-badge"
      aria-label={`Grade ${letter}`}
    >
      <polygon points={points} fill={color} opacity="0.55" />
      <circle cx="50" cy="50" r="40" fill={color} />
      <circle
        cx="50" cy="50" r="40"
        fill="none"
        stroke="rgba(0, 0, 0, 0.55)"
        strokeWidth="1.5"
      />
      <circle
        cx="50" cy="50" r="35"
        fill="none"
        stroke="rgba(0, 0, 0, 0.32)"
        strokeWidth="0.5"
        strokeDasharray="2 2.4"
      />
      <text
        x="50"
        y="67"
        textAnchor="middle"
        fontFamily="Bebas Neue, Impact, sans-serif"
        fontSize="50"
        fill="#14151c"
        style={{ fontWeight: 700, letterSpacing: 0 }}
      >
        {letter}
      </text>
    </svg>
  );
}

function LevelChip({ label, price, color }) {
  if (price == null) return null;
  return (
    <div className="dx-tp-chip" style={{ "--cc": color }}>
      <span className="dx-tp-chip-l">{label}</span>
      <span className="dx-tp-chip-v">${price}</span>
    </div>
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
        <DexGlyph small pulsing />
      </div>
      <div className="dx-bub dx-typing">
        <span />
        <span />
        <span />
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

function DexGlyph({ small, large, pulsing }) {
  const size = large ? 96 : small ? 28 : 56;
  const id = large ? "l" : small ? "s" : "m";
  return (
    <span
      className={`dx-glyph ${pulsing ? "is-pulsing" : ""}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
        <defs>
          <radialGradient id={`dx-grad-${id}`} cx="50%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#FFE36B" />
            <stop offset="55%" stopColor="#FFD600" />
            <stop offset="100%" stopColor="#6e5800" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="28" fill={`url(#dx-grad-${id})`} />
        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
        <text
          x="50%"
          y="58%"
          textAnchor="middle"
          fontFamily="Bebas Neue, Impact, sans-serif"
          fontSize={large ? 56 : small ? 22 : 38}
          fill="#14151c"
          letterSpacing="1"
        >
          D
        </text>
      </svg>
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
  font-family: "Crimson Pro", "Segoe UI", system-ui, sans-serif;
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
  border-bottom: 1px solid rgba(255, 214, 0, 0.08);
  background: rgba(8, 9, 14, 0.6);
  backdrop-filter: blur(10px);
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
  font-family: "Bebas Neue", sans-serif;
  letter-spacing: 0.22em;
  font-size: 19px;
  color: #FFD600;
}
.dx-top-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  font-family: "JetBrains Mono", monospace;
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
  font-family: "JetBrains Mono", monospace;
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

/* ── Welcome state ───────────────────────────────────────────────────── */
.dx-welcome {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
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
  font-family: "Bebas Neue", sans-serif;
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
  font-family: "Crimson Pro", "Segoe UI", sans-serif;
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
  font-family: "Bebas Neue", sans-serif;
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
  font-family: "JetBrains Mono", monospace;
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #8b90a8;
}
.dx-pill-v {
  font-family: "JetBrains Mono", monospace;
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
  font-family: "Bebas Neue", sans-serif;
  font-size: 12px;
  letter-spacing: 0.1em;
  padding: 3px 8px;
  border: 1px solid currentColor;
  border-radius: 5px;
  text-align: center;
}
.dx-lvl-px {
  font-family: "JetBrains Mono", monospace;
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
  font-family: "Bebas Neue", sans-serif;
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
  border-top: 1px solid rgba(255, 214, 0, 0.08);
  background: rgba(8, 9, 14, 0.85);
  backdrop-filter: blur(10px);
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
  font-family: "Crimson Pro", "Segoe UI", sans-serif;
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
  font-family: "Bebas Neue", sans-serif;
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
.dx-voice-cap-dim  { color: #7a7e92; font-family: "JetBrains Mono", monospace; font-size: 14px; letter-spacing: 0.06em; }
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
  font-family: "JetBrains Mono", monospace;
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
  font-family: "JetBrains Mono", monospace;
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
  font-family: "JetBrains Mono", monospace;
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
  font-family: "Bebas Neue", sans-serif;
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
  font-family: "Bebas Neue", sans-serif;
  font-size: 30px;
  letter-spacing: 0.06em;
  color: #FFD600;
  line-height: 1;
}
.dx-card-tf {
  font-family: "JetBrains Mono", monospace;
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
  padding: 8px 12px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.02));
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 8px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}
.dx-card-stat-l {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #6c708a;
}
.dx-card-stat-v {
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: capitalize;
}

/* ── Trade Terminal Panel (graded messages) ────────────────────────── */
.dx-tp {
  width: 100%;
  background: linear-gradient(180deg, rgba(14, 16, 22, 0.95), rgba(8, 10, 16, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.55);
  animation: dx-msg-in 0.32s ease both;
}

.dx-tp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.02));
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  flex-wrap: wrap;
}
.dx-tp-id { display: flex; align-items: center; gap: 14px; min-width: 0; }
.dx-tp-badge { flex-shrink: 0; }
.dx-tp-id-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.dx-tp-ticker {
  font-family: "Bebas Neue", sans-serif;
  font-size: 24px;
  letter-spacing: 0.06em;
  color: #FFFFFF;
  line-height: 1;
}
.dx-tp-sub {
  font-family: "JetBrains Mono", monospace;
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
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 360px;
}
.dx-tp-section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: "Bebas Neue", sans-serif;
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
  font-family: "JetBrains Mono", monospace;
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
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.02));
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 10px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}
.dx-tp-chip-l {
  font-family: "Bebas Neue", sans-serif;
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--cc, #FFD600);
  text-transform: uppercase;
}
.dx-tp-chip-v {
  font-family: "JetBrains Mono", monospace;
  font-size: 18px;
  font-weight: 600;
  color: var(--cc, #FFD600);
  line-height: 1.1;
}

.dx-tp-bottom {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0, 0, 0, 0.15);
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
  font-family: "Bebas Neue", sans-serif;
  font-size: 12px;
  letter-spacing: 0.22em;
  color: #6c708a;
  text-transform: uppercase;
}
.dx-card-chart-tf {
  font-family: "JetBrains Mono", monospace;
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
  font-family: "Bebas Neue", sans-serif;
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
  font-family: "Bebas Neue", sans-serif;
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--lc, #FFD600);
  text-transform: uppercase;
}
.dx-card-lvl-price {
  font-family: "JetBrains Mono", monospace;
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
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.02));
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 10px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}
.dx-card-insight.is-alert {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.02));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
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
  font-family: "Bebas Neue", sans-serif;
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
  font-family: "JetBrains Mono", monospace;
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
