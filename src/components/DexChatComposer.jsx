// Dex chat composer. Refactor of src/components/ui/animated-ai-chat.jsx into a
// controlled component: parent owns `value` / `disabled` / `loading` and gets
// callbacks for change, submit, and voice. The original ships as a full-page
// mock with hard-coded "Clone UI / Import Figma / Create Page / Improve"
// suggestions and a fake 3-second typing simulator; that's been ripped out.
//
// Visual changes vs the source:
// - Violet/indigo/fuchsia accents → Dex yellow (#FFD600)
// - "How can I help today?" hero removed (Welcome already renders the orb)
// - Command-palette slash UI kept but unused for now (suggestions=[] by
//   default); the parent can pass `suggestions` if it wants to wire commands
//   like "/grade" later.
// - Mock attachment system kept but hidden behind `showAttach` prop, off by
//   default — Dex doesn't accept file uploads yet.
//
// Props (all required unless noted):
//   value              string
//   onChange           (next: string) => void
//   onSubmit           () => void  — called on Enter (no shift) or Send click
//   placeholder        string
//   disabled?          boolean  — disables the whole composer (e.g. mid-send)
//   loading?           boolean  — shows the spinner inside the Send button
//   onVoice?           () => void  — if provided, renders a mic button

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// All icons inlined as SVG to remove lucide-react as a possible failure mode.
// The user's lucide-react is pinned at ^1.16.0 (pre-fork era) and the exports
// shift between versions; safer to ship our own four-line glyphs.
const iconProps = (size) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});
const MicGlyph = ({ size = 16 }) => (
  <svg {...iconProps(size)}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);
const SendGlyph = ({ size = 16 }) => (
  <svg {...iconProps(size)}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const LoaderGlyph = ({ size = 16, className }) => (
  <svg {...iconProps(size)} className={className}>
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
  </svg>
);
const XGlyph = ({ size = 12 }) => (
  <svg {...iconProps(size)}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const PaperclipGlyph = ({ size = 16 }) => (
  <svg {...iconProps(size)}>
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

function useAutoResizeTextarea({ minHeight, maxHeight }) {
  const textareaRef = useRef(null);

  const adjustHeight = useCallback((reset) => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (reset) {
      ta.style.height = `${minHeight}px`;
      return;
    }
    ta.style.height = `${minHeight}px`;
    const next = Math.max(
      minHeight,
      Math.min(ta.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY),
    );
    ta.style.height = `${next}px`;
  }, [minHeight, maxHeight]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = `${minHeight}px`;
    }
  }, [minHeight]);

  useEffect(() => {
    const onResize = () => adjustHeight();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

export default function DexChatComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled = false,
  loading = false,
  onVoice,
  showAttach = false,
  suggestions = [],
  onSuggestion,
}) {
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 200,
  });
  const [focused, setFocused] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [attachments, setAttachments] = useState([]);

  // The original tracks the cursor across the viewport so it can drag a giant
  // diffuse glow behind the input on focus. Cheap effect, keeps the page
  // feeling alive even when the orb is offscreen.
  useEffect(() => {
    const onMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Resize the textarea every time the value changes from outside (e.g. when
  // Dex clears it after send), not just on local typing.
  useEffect(() => {
    adjustHeight(value === "" ? true : false);
  }, [value, adjustHeight]);

  const submit = () => {
    if (disabled || loading) return;
    if (!value || !value.trim()) return;
    onSubmit();
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const canSend = !!value?.trim() && !disabled && !loading;

  return (
    <div className="dx-composer-wrap">
      {/* Glow that drifts with the cursor when the input is focused. */}
      {focused && (
        <motion.div
          aria-hidden
          className="dx-composer-aura"
          animate={{ x: mousePos.x - 400, y: mousePos.y - 400 }}
          transition={{ type: "spring", damping: 25, stiffness: 150, mass: 0.5 }}
        />
      )}

      <motion.div
        className="dx-composer-shell"
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        {/* Textarea row */}
        <div className="dx-composer-pad">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              adjustHeight();
            }}
            onKeyDown={onKey}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            disabled={disabled}
            maxLength={2000}
            rows={1}
            className="dx-composer-ta-new"
            style={{ overflow: "hidden" }}
          />
        </div>

        {/* Optional attachment chips. Hidden by default. */}
        <AnimatePresence>
          {showAttach && attachments.length > 0 && (
            <motion.div
              className="dx-composer-attach"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              {attachments.map((file, i) => (
                <motion.div
                  key={i}
                  className="dx-composer-chip"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                >
                  <span>{file}</span>
                  <button
                    type="button"
                    className="dx-composer-chip-x"
                    onClick={() =>
                      setAttachments((arr) => arr.filter((_, j) => j !== i))
                    }
                  >
                    <XGlyph size={12} />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tool row (left: voice + attach, right: Send) */}
        <div className="dx-composer-row-new">
          <div className="dx-composer-tools-new">
            {onVoice && (
              <motion.button
                type="button"
                onClick={onVoice}
                disabled={disabled}
                whileTap={{ scale: 0.94 }}
                className="dx-composer-tool"
                aria-label="Voice mode"
                title="Voice mode"
              >
                <MicGlyph size={16} />
              </motion.button>
            )}
            {showAttach && (
              <motion.button
                type="button"
                onClick={() =>
                  setAttachments((arr) => [
                    ...arr,
                    `file-${Math.floor(Math.random() * 1000)}.pdf`,
                  ])
                }
                disabled={disabled}
                whileTap={{ scale: 0.94 }}
                className="dx-composer-tool"
                aria-label="Attach"
                title="Attach"
              >
                <PaperclipGlyph size={16} />
              </motion.button>
            )}
          </div>

          <motion.button
            type="button"
            onClick={submit}
            disabled={!canSend}
            whileHover={canSend ? { scale: 1.02 } : {}}
            whileTap={canSend ? { scale: 0.97 } : {}}
            className={`dx-composer-send-new${canSend ? " is-ready" : ""}`}
            aria-label="Send"
          >
            {loading ? (
              <LoaderGlyph size={16} className="dx-spin" />
            ) : (
              <SendGlyph size={16} />
            )}
            <span>Send</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Suggestion pills row — sits just under the shell, mirrors the
       * reference design's "Clone UI / Import Figma / Create Page / Improve"
       * footer. Each pill submits its text immediately so the user doesn't
       * have to manually press Send. */}
      {suggestions.length > 0 && (
        <div className="dx-composer-suggest">
          {suggestions.map((s, i) => (
            <motion.button
              key={i}
              type="button"
              onClick={() => (onSuggestion ? onSuggestion(s) : null)}
              disabled={disabled}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
              whileHover={{ y: -1 }}
              className="dx-composer-suggest-btn"
            >
              {s}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
