# Continue the SootyDex /dex redesign

You're picking up an in-progress redesign. Read this whole brief before doing
anything. Where I say "the user", I mean the person you're helping.

---

## Where you are

- **Repo:** `D:\SootyDex\Website` — a Vite + React app called "sootyedge". The
  `/dex` route renders `src/components/Dex.jsx` (path routing happens in
  `src/App.jsx`; search for `/^\/dex/?$/`).
- **Branch:** `rawki-edits` (branched off `origin/main`). Do **not** push to
  `main`. Commit work to `rawki-edits`.
- The working tree may show ~40 files as "modified" — that's CRLF vs LF, not
  real edits. Treat them as clean.
- `node_modules` is installed.

---

## What's already done — do NOT redo

1. **Anthropic OAuth subscription support** is wired into `api/dex/chat.js`
   (uses `ANTHROPIC_OAUTH_TOKEN` if set, otherwise falls back to
   `ANTHROPIC_API_KEY`). Don't touch the backend.
2. `.env.example` and `.env.local` document/scaffold the OAuth token. Don't
   touch.
3. **Adobe Typekit font** is added to `index.html` (`use.typekit.net/jog8xav.css`).
4. **Reactive 3D hero** at `src/components/DexReactiveCore.jsx` — a Three.js
   icosahedron with noise-displaced shader. Already wired into the Welcome
   screen of `Dex.jsx`. State is driven by a `heroState` value derived from
   `sending` / `input` / `lastResponseAt` (search Dex.jsx for `heroState`).
5. The old SVG planetarium `DexCore` function is still at the bottom of
   `Dex.jsx` (~line 1104). It's dead code now; delete it after Task 0.

---

## Reference materials

- `D:\SootyDex\Rawki\profile.tsx` — the user's design for a profile/credits
  popup, written in TSX. The project is JSX — you'll convert.
- `D:\SootyDex\Rawki\ref-imgs\Bottom-needs-tooltips.png` — the compact
  entry/stop/TP pill row (this stays).
- `D:\SootyDex\Rawki\ref-imgs\corresponding-tooltips.png` — the verbose
  per-level paragraphs (these become tooltip CONTENT).
- `D:\SootyDex\Zi-notes.txt` — original requirements list.

---

## Tasks, in order

### Task 0 — Crank the ripple way down (do this first)

The user reports "it starts zooming" when they type. The typing state is too
aggressive. In `src/components/DexReactiveCore.jsx` replace `STATE_TARGETS`
with these gentler values:

```js
const STATE_TARGETS = {
  idle:       { amp: 0.07,  speed: 0.30, glow: 0.85 },
  typing:     { amp: 0.085, speed: 0.36, glow: 0.92 },
  sending:    { amp: 0.18,  speed: 0.55, glow: 1.18 },
  thinking:   { amp: 0.13,  speed: 0.72, glow: 1.00 },
  responding: { amp: 0.11,  speed: 0.55, glow: 1.10 },
};
```

Then also reduce the lerp factor from `0.06` to `0.04` so transitions feel
slower and more elegant (search for `0.06` in the animate loop).

The deltas between states should be subtle. Idle → typing should be barely
perceptible. Sending = noticeable but contained burst. Thinking = smooth
ongoing wave that doesn't feel frenetic. If it still feels hot after this,
halve `typing.amp` again.

Have the user reload `/dex`, type a few characters, then send a message. If
they say it's still too much, drop everything by another ~30%.

---

### Task 1 — Tooltips on the trade plan chips (Item 1)

In `src/components/Dex.jsx` search for `<LevelChip label="Entry"`. You'll
find at least one block rendering Entry / Stop / TP1 / TP2 / TP3 chips, and
a separate `<LvlRow label="Entry"` block that renders the verbose per-level
reasoning paragraphs underneath.

**Goal:** keep the compact chip row, hide the verbose `LvlRow` block, and
move the reasoning text into a hover tooltip on each chip.

- Use `src/components/ui/tooltip.jsx` (already installed).
- The grade object has `entry_reason`, `stop_reason`, `tp1_reason`,
  `tp2_reason`, `tp3_reason` fields — these are the tooltip content.
- Wrap each `<LevelChip />` in `<Tooltip><TooltipTrigger asChild>...
  </TooltipTrigger><TooltipContent>{reason}</TooltipContent></Tooltip>`.
- Don't forget to mount `<TooltipProvider>` at the top of the Dex tree (once,
  not per chip).
- Visual intent: the user's ref images in `D:\SootyDex\Rawki\ref-imgs`.

---

### Task 2 — Swap in the better processing animation (Item 3)

The current "thinking" indicator in `Dex.jsx` is `<Typing />` (search for it).
Replace it with the loader at `src/components/loader.jsx`. Use during
`sending: true` while waiting for the model to respond. Keep the loader sized
proportional to a chat row, not full-screen.

---

### Task 3 — New chat input style (Item 7)

Replace the existing chat input + send button at the bottom of `Dex.jsx`
with `src/components/ui/animated-ai-chat.jsx`. Map its submit handler to the
existing `send()` function inside Dex.

Keep the voice mic button **for now** — leave it as a button that opens the
existing `VoiceMode`. Voice quality replacement (item 2) is on hold pending
the user's OpenAI TTS decision.

---

### Task 4 — Profile page (Item 8)

The user has a reference at `D:\SootyDex\Rawki\profile.tsx` that needs to
become a real component.

**Step 4a — Install missing components first:**

```bash
npx shadcn@latest add card avatar progress
```

The user also wanted a fancier avatar icon for the header trigger (from
21st.dev shugar/avatar-1):

```bash
npx shadcn@latest add https://21st.dev/r/shugar/avatar-1
```

**Step 4b — Check lucide-react version.** `package.json` currently pins
`lucide-react: ^1.16.0` which is an ancient pre-fork release missing modern
icons (CreditCard, TrendingUp, Calendar, AlertCircle — all needed by
profile.tsx). Bump:

```bash
npm install lucide-react@latest
```

**Step 4c — Convert `profile.tsx` → `src/components/Profile.jsx`:**

- Strip TypeScript interfaces (`CreditInfo`, `UserProfileData`,
  `UserProfileProps`).
- Replace `React.forwardRef<HTMLDivElement, UserProfileProps>` with plain
  `React.forwardRef` (no generics) or a plain function component if the ref
  forward isn't needed.
- Keep all the imports intact — they reference `@/components/ui/*` which
  resolves via the existing alias in `vite.config.js`.

**Step 4d — Wire the profile trigger into the Dex header:**

In `Dex.jsx` find the top header. Currently it shows `online | By SootyEdge`
in the top right. Add an avatar button there. Clicking opens a dialog or
popover containing the `<Profile />` component (the user said "popup", not a
new route).

If a Dialog component isn't installed, install it:

```bash
npx shadcn@latest add dialog
```

---

### Task 5 — Pricing card (Item 9)

The user said a "button error" appeared when previewing
`single-pricing-card-1`. Open both files:

- `src/components/single-pricing-card-1.jsx`
- `src/components/ui/button.jsx`

Likely cause: the pricing card imports a named export the installed Button
doesn't expose, or imports from a path that doesn't match the alias config.
Reconcile imports and run `npm run build` to confirm.

Then decide where pricing lives. Suggestion: add a `/pricing` route to
`src/App.jsx` using the same path-based routing pattern as `/dex`. Style
should match the dark/yellow Dex aesthetic.

---

### Task 6 — Infinite grid background (Item 10)

Drop `src/components/the-infinite-grid.jsx` behind the `/dex` view.

The current background effects (particles, spotlight, cursor) live in
`src/App.jsx` (search for `<canvas`, `Spotlight`, `Cursor`). The new
infinite-grid should sit behind those — at a lower z-index — or you can
replace them if the new grid is visually dominant.

Render it once at the top of `Dex.jsx`'s return, with negative z-index and
`pointer-events: none`. Test that the chat input + clicks above it still
work.

---

## Tasks NOT to do

- **Item 2 (voice quality replacement).** Pinned by the user pending an
  OpenAI TTS decision. Don't change `pickPreferredVoice` or anything in the
  `VoiceMode` component for now.
- **Item 4 (OAuth)** — already done. Leave `api/dex/chat.js` alone unless
  the user explicitly asks.

---

## Constraints

- Don't touch `api/` unless the user explicitly asks.
- Don't downgrade or sideways-swap any of the user's curated frontend deps
  (radix-ui, tailwindcss v4, shadcn, framer-motion, three). Only upgrade
  `lucide-react` (explicit task above).
- Run `npm run build` at the end and fix any errors before reporting done.
- Commit each completed item as its own commit on `rawki-edits`. Format:
  `dex(task N): <short summary>`. Don't squash — the user wants to be able
  to revert individual items.
- The user is on Windows. File paths in their environment use `\`. Bash on
  the user's machine (Git Bash / WSL) accepts both.

---

## When you're done

Report back with:
1. Which tasks shipped cleanly.
2. Which had blockers and what they were.
3. What the user should verify visually (e.g., "load /dex, type something,
   the orb should barely ripple. Send a ticker, the orb should pulse harder
   and the response chips should have tooltips on hover.").
4. Any deferred work or open questions.

Pinned: voice (Item 2). Out of scope: production deployment.
