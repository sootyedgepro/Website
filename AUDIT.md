# SootyEdge — Website Audit

**Date**: 2026-05-22
**Scope**: live site (sootyedge.com / www.sootyedge.com) + repo (Vite/React SPA + Vercel serverless API)
**Auditor**: website developer audit

## Summary

| Severity | Count | Examples |
|----------|-------|----------|
| CRITICAL | 2     | Wildcard CORS + email-keyed rate limit, Airtable formula injection |
| HIGH     | 8     | Missing security headers, canonical mismatch, no robots/sitemap, no SSR, 1.2MB hero PNG, monolithic 428KB bundle, in-memory serverless state, mainthread storm |
| MEDIUM   | 11    | Fake-looking reviews, no analytics, FAQ a11y, schema gaps, font loading, JSON-LD escaping, weak email validation, embedded CSS string, footer/TIERS drift |
| LOW      | 3     | dist/ committed, dex-prompt.md exposed, 89KB logo SVG |

## A. Security

### 🔴 CRITICAL-01 — Wildcard CORS + email-keyed rate limit = unlimited Anthropic spend
**Files**: `api/dex/chat.js:97`, `api/analyze/index.js:51`, `api/chat/start.js:47`, `api/_lib/rate-limit.js:5–35`

All three Claude-billing endpoints set `Access-Control-Allow-Origin: *` and key their rate limit on a client-supplied `email`. Attacker on any origin rotates emails and bypasses the 50/day cap on every request, draining the ANTHROPIC_API_KEY.

**Fix**: pin CORS to allowlist; IP-based floor; require verified email or signed JWT; move limiter to Redis.

### 🔴 CRITICAL-02 — Airtable formula injection in `findMember`
**File**: `api/_lib/airtable.js:31`

```js
filterByFormula: `LOWER({email}) = LOWER("${email.replace(/"/g, '\\"')}")`,
```

The escape only handles `"`, not `\`. Crafted email payload can rewrite the predicate and dump the Members table. Once `PHASE_2_OPEN_MEMBERSHIP=false`, the same bug becomes an auth bypass for `/api/analyze`.

**Fix**: validate email format strictly before interpolation; escape both `\` and `"`; ideally migrate to record-ID lookups.

### 🟠 HIGH-01 — Missing security headers
Only `Strict-Transport-Security` is set on responses. No CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, or Permissions-Policy. Site is iframe-able (clickjacking risk for the Stripe buttons).

**Fix**: add `"headers"` block to `vercel.json`.

### 🟠 HIGH-02 — In-memory state on serverless
`api/dex/chat.js:24` (`sessions = new Map()`) and `api/_lib/rate-limit.js:8` (`buckets = new Map()`) hold per-instance state. Vercel forks instances under load, so rate limits and chat memory are unreliable.

**Fix**: Upstash Redis / Vercel KV.

### 🟡 MEDIUM-01 — Email validated only by `.includes("@")`
**File**: `api/analyze/index.js:69` — accepts `@`, `a@`, `@b`, `a@@b`.

### 🟡 MEDIUM-02 — `dangerouslySetInnerHTML` with `JSON.stringify` for JSON-LD
**File**: `src/App.jsx:131` — JSON.stringify doesn't escape `</script>`. Currently safe (constant data), but technical debt.

## B. SEO & Discoverability

### 🟠 HIGH-03 — Canonical / og:url mismatch with redirect target
Apex 307s to www, but HTML at www declares canonical/og:url as apex. Google loops between variants.

**Fix**: pick one. Recommended: serve at apex, drop the 307.

### 🟠 HIGH-04 — No robots.txt, no sitemap.xml
Both return 404. No crawl hints for `/dex`, `/refund-policy`, or the main route.

### 🟠 HIGH-05 — Content is JS-rendered only (no SSR / SSG)
`index.html:37` body is `<div id="root"></div>`. Marketing copy is locked behind a 428KB JS bundle. JS-skipping crawlers (most AI search) see nothing.

### 🟡 MEDIUM-03 — No FAQ / Organization schema
`src/App.jsx:131` has Product schema (good) but not FAQPage or Organization. FAQ rich snippets are easy CTR wins.

### 🟡 MEDIUM-04 — Uninformative alt text
`src/App.jsx:60, 91` use `alt="SootyEdge Mobile"` / `alt="SootyEdge Desktop"`. Should describe content.

## C. Performance & Core Web Vitals

### 🟠 HIGH-06 — 1.2MB unoptimized PNG hero
`public/Phone_Hub.png` is 1.2MB; `Computer_Hub.png` is 334KB. LCP killer on mobile.

**Fix**: AVIF + WebP fallback via `<picture>`. Add `fetchpriority="high"` to the LCP image.

### 🟠 HIGH-07 — 428KB single JS bundle
`dist/assets/index-DP8R_Q7L.js` includes marketing site, Dex chat, modal content, and 169-line inline CSS string.

**Fix**: `React.lazy(() => import("./components/Dex"))`. Extract CSS string to a real `.css` file.

### 🟠 HIGH-08 — Canvas + custom cursor + tilt = main-thread storm on mobile
`src/App.jsx:8-46`: 55-particle constellation with O(N²) link check on rAF; spotlight rAF; cursor rAF; tilt mousemove; `body{cursor:none}` site-wide. No `prefers-reduced-motion` respect. INP penalty on mid-tier Android. A11y violation.

### 🟡 MEDIUM-05 — Fonts loaded inside React component
`src/App.jsx:189, 199` insert `<link href="…googleapis…">` post-mount. FOUT on hero. Move to `index.html <head>` with `preconnect`.

### 🟡 MEDIUM-06 — 89KB logo SVG
`public/sootyedge_logo.svg` — should be <5KB. Run through `svgo --multipass`.

## D. Conversion & UX

### 🟠 HIGH-09 — Reviews are unverifiable / generic
`src/App.jsx:114-119` — four reviews with initials only, no photos, no source links. Sophisticated buyers pattern-match this as fake. FTC endorsement-guideline exposure for financial products.

**Fix**: replace with verifiable Discord/YouTube/X testimonials or remove the section.

### 🟠 HIGH-10 — No analytics, no funnel tracking
No GA4, GTM, Plausible, PostHog. Stripe `MagBtn` clicks aren't tracked.

**Fix**: Plausible/PostHog + Stripe `client_reference_id` on checkout URLs.

### 🟡 MEDIUM-07 — Modal & FAQ a11y gaps
- Modal (`App.jsx:139`): no `role="dialog"`, no focus trap, no ESC handler.
- FAQ (`App.jsx:135`): `onClick` on `<div>` — no `role="button"`, no `aria-expanded`, no keyboard support.
- `body{cursor:none}` removes focus indicator.

**Fix**: use `<details>/<summary>` for FAQ; add `role/aria-modal/focus trap/ESC` to Modal.

## E. Code Quality

### 🟡 MEDIUM-08 — 169 lines of CSS embedded as a JS template string
`src/App.jsx:169` — can't be code-split, tree-shaken, linted, or cached separately.

### 🟡 MEDIUM-09 — Pricing strings duplicated between footer and TIERS
`src/App.jsx:143` hardcodes `"Suite — $99/mo"` etc. vs. `TIERS` at line 130.

### 🔵 LOW-01 — `dist/` committed
Should be `.gitignore`d.

### 🔵 LOW-02 — `dex-prompt.md` at repo root
If repo is public, your system prompt is too.

## F. Test Coverage

### 🟡 MEDIUM-10 — No tests
No `*.test.js`, `vitest`, or `jest` config. SootyEdge framework helpers (`labelActionZones`, `computeFlowScore` in `api/dex/chat.js:401-543`) and grade-JSON parsing are unexercised.

---

## Recommended Phase 1 (the cost & SEO leaks — 1.5 days)

1. CORS allowlist + IP-based rate-limit floor + Airtable escape fix + email validation
2. Security headers in `vercel.json`
3. Canonical/www decision + robots.txt + sitemap.xml + FAQ schema
4. Hero PNG → AVIF/WebP + `fetchpriority` + fonts in `<head>`
5. Plausible + Stripe `client_reference_id`

## Phase 2 (conversion + maintainability — 1 week)

6. Replace fabricated reviews (verifiable proof or remove)
7. Code-split Dex; extract CSS string to file
8. A11y: FAQ to `<details>`; Modal `aria-*` + focus trap; drop `cursor:none`; `prefers-reduced-motion`
9. Bundle audit; lazy-load images; reduce constellation particles + cap rAF

## Phase 3 (scale — 1-2 weeks)

10. SSG/SSR migration (Astro or Next.js) for marketing routes; Dex stays SPA
11. Sessions + rate limits → Upstash Redis
12. Verified-email or signed-JWT membership for Dex
13. Vitest coverage on framework helpers + parse functions
14. Monitoring + cost alerts on Anthropic spend
