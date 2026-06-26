# SootyDex — Items 1 (tooltips on chips) + 3 (better loader), with OAuth check first

You're picking up two tasks on the SootyDex `/dex` page that both require
sending a real message to test. Before either is verifiable, you need to
confirm that `/api/dex/chat` is actually authenticating via the user's
Claude Code OAuth token (not the paid API key), so the dev session
spends from their subscription instead of API billing.

## Where you are

- **Repo:** `D:\SootyDex\Website`
- **Branch:** `rawki-edits` (do NOT push to main, do NOT touch `api/dex/chat.js`
  beyond the diagnostic logging in Task 0 unless you absolutely need to)
- **Backend route:** `api/dex/chat.js` — this is what `/api/dex/chat` posts to
  (Vercel serverless). It already has an OAuth code path: if
  `process.env.ANTHROPIC_OAUTH_TOKEN` is set, it uses `authToken` +
  `anthropic-beta: oauth-2025-04-20` + a Claude Code identity system block.
  Otherwise falls back to `ANTHROPIC_API_KEY`.
- **Frontend dev:** Vite at `npm run dev` only serves the SPA — it does NOT
  host the serverless `api/` folder. To exercise `/api/dex/chat` locally you
  must run `vercel dev` (which Vite + the Vercel CLI cooperate on) OR have
  the user route to a deployed preview URL.
- **The orb:** lives at `src/components/DexReactiveCore.jsx` — the user has
  iterated on it. Don't touch.
- **The chat composer:** `src/components/DexChatComposer.jsx`. Don't touch.

---

## Task 0 — Verify OAuth is actually in use (do this FIRST)

The user wants to confirm requests go through their Claude Max/Pro OAuth
quota, not the API key. Concretely:

1. **Confirm env wiring:**
   - Open `D:\SootyDex\Website\.env.local`. Is `ANTHROPIC_OAUTH_TOKEN=` followed
     by an actual token (starts with `sk-ant-oat01-`)?
   - If empty or missing, tell the user: "Paste your OAuth access token from
     `%USERPROFILE%\.claude\.credentials.json` (the `access_token` field)
     into `.env.local` after `ANTHROPIC_OAUTH_TOKEN=`." Then wait — they need
     to do this step. Don't fake a token.

2. **Add temporary diagnostic logging to `api/dex/chat.js`** so the dev server
   logs which auth mode each request used. Right after the `const client = ...`
   block (search for `USE_OAUTH ? new Anthropic` around line 150), add:

   ```js
   console.log(
     "[dex/chat] auth =",
     USE_OAUTH ? "OAUTH (claude code subscription)" : "API_KEY",
     "| token prefix:",
     USE_OAUTH ? OAUTH_TOKEN?.slice(0, 14) : process.env.ANTHROPIC_API_KEY?.slice(0, 14)
   );
   ```

   This logs to the `vercel dev` terminal on every chat request so you can
   tell at a glance which path fired.

3. **Run `vercel dev`** (or have the user run it) and watch for the
   `[dex/chat] auth = OAUTH (claude code subscription) | token prefix: sk-ant-oat01-...`
   line on first chat. If you see `API_KEY` instead, OAuth fallback didn't
   trigger — re-check the env var name, file path, and `vercel dev` env
   loading.

4. **Strip the diagnostic logging** (or leave behind a single-line conditional
   that only prints when `process.env.DEX_DEBUG_AUTH === "1"`) before
   committing. Don't ship console spam to production.

5. **Commit on `rawki-edits`** as `dex: verify oauth auth path (diagnostic)`.

You can move to Tasks 1 and 2 only after seeing OAUTH in the log.

---

## Task 1 — Tooltips on the trade plan chips (Item 1 in user list)

When Dex grades a setup, the response card renders five chips at the bottom:
Entry / Stop / TP1 / TP2 / TP3 — each with just the price. Currently a
separate verbose `<LvlRow>` block renders all the reasoning paragraphs
underneath those chips, which crowds the response. Reference images in
`D:\SootyDex\Rawki\ref-imgs\`:

- `Bottom-needs-tooltips.png` — the compact pill row (this is what we want
  to keep visible)
- `corresponding-tooltips.png` — the verbose per-level paragraphs (this is
  what should live inside the tooltips, hidden until hover)

**Steps:**

1. Open `src/components/Dex.jsx`. Search for `<LevelChip label="Entry"`.
   You'll find at least two render sites — one in the card body where the
   chips currently render, and a parallel `<LvlRow label="Entry"` block that
   renders the verbose paragraphs.

2. The grade object includes `entry_reason`, `stop_reason`, `tp1_reason`,
   `tp2_reason`, `tp3_reason` — these are the tooltip content. They come
   straight from the Anthropic response per the system prompt's
   "2-sentence reasoning per level" rule.

3. Wrap each `<LevelChip />` in a shadcn Tooltip from
   `src/components/ui/tooltip.jsx` (already installed, uses
   `@radix-ui/react-tooltip`):

   ```jsx
   <Tooltip>
     <TooltipTrigger asChild>
       <LevelChip label="Entry" price={grade.entry} color="#FFD600" />
     </TooltipTrigger>
     <TooltipContent side="top" className="max-w-xs">
       {grade.entry_reason}
     </TooltipContent>
   </Tooltip>
   ```

   Don't forget the existing `<TooltipProvider>` already wraps the Dex tree
   (search for `<TooltipProvider delayDuration={`) — no need to add another.

4. Remove the verbose `<LvlRow>` block. Search for `<LvlRow` and delete
   each render of it. Leave the `LvlRow` function definition alone for now
   in case the user wants to bring it back; just don't render it.

5. Style: the tooltip should look on-brand with the dark/yellow Dex
   aesthetic. The default shadcn `TooltipContent` styling may need a tweak
   in `src/components/ui/tooltip.jsx` (background, border, text color).
   Match the composer's glassmorphic feel:
   `bg-[rgba(14,15,22,0.96)] border border-[rgba(255,214,0,0.18)] text-[#d9dde8]`.

6. **Test by sending a grade prompt.** The user is set up; one of the chip
   prompts is "Grade NVDA (1h)". Click it (or paste), wait for the grade,
   then hover each chip — the corresponding reasoning paragraph should
   appear above. Verify content matches `entry_reason` etc.

7. Commit as `dex(item 1): tooltips on trade plan chips`.

---

## Task 2 — Better processing animation (Item 3 in user list)

While Dex is waiting on the model response (the `sending: true` window),
the chat currently shows a basic `<Typing />` dot pulse. Replace it with
the loader at `src/components/loader.jsx` (already installed).

**Steps:**

1. Open `src/components/loader.jsx` and inspect what it exports. Most
   shadcn loaders are a default export of a self-contained component;
   confirm the export name and any required props (size, color, etc).

2. In `src/components/Dex.jsx` search for `<Typing />`. It's rendered when
   `sending` is true, just below the message stream. Replace that JSX with
   the loader. Match the size to a chat row (roughly 40-56px tall — not
   full-screen).

3. The composer's Send button also shows a spinner via the inlined
   `LoaderGlyph` in `DexChatComposer.jsx`. Leave that alone — the loader
   swap is only for the in-stream waiting indicator.

4. If the new loader has color props, pass the Dex yellow `#FFD600`.
   Otherwise wrap it with a `color: #FFD600` style.

5. **Test by sending a grade prompt.** The loader should appear within
   the stream right after you press Send and disappear when the grade
   lands. Same prompt as Task 1 works.

6. Commit as `dex(item 3): swap thinking indicator to loader`.

---

## Tasks NOT to do in this prompt

- Item 2 (voice quality) — pinned by the user, do NOT touch
  `pickPreferredVoice` / `VoiceMode` / the mic button.
- Item 8 (profile) — user has a working placeholder popover already;
  full profile design is a later task.
- Item 9 (pricing) — the user added a placeholder pricing section inside
  the profile popover already.
- Item 10 (infinite grid) — already shipped.
- Orb changes — the user has been iterating on `DexReactiveCore.jsx`
  themselves. Leave it alone.

---

## When you're done

Report:

1. Did the diagnostic log show OAuth on chat requests?
2. Did the tooltips render the right reason text on hover, on a fresh
   grade?
3. Did the loader appear during the model wait window and disappear
   afterwards?
4. Anything blocked? Anything left dangling?

If anything fails, paste the exact error text and stop — don't guess.
