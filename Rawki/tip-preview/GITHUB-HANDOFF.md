# Traveling in Profit source handoff

This directory preserves the latest Traveling in Profit (TIP) source from the
SootyEdge Interactive Suite preview. It is an isolated, buildable package; the
existing React/Vite application at the repository root is unchanged.

## Source

- Source version: 22, saved November 10, 2026 (UTC).
- Source commit: `54fb937677dbb3e23a1823f6d8f0daf9c88f367f`.
- Preview: https://sootyedge-interactive-suite.rawki.chatgpt.site/travelinginprofit/
- GitHub destination: https://github.com/sootyedgepro/Website

The 332 tracked source files were copied without modifying their contents.
Generated output, dependencies, Git history, local credentials, and private CRM
records are not included. TIP shares its build, same-origin navigation, asset
host, consent tracking, and server relay with the SootyEdge companion preview,
so that supporting source is retained here rather than separating it into an
incomplete application. The SLA agency/CRM application itself is not included.

## Included TIP updates

- Redesigned class funnel, agenda, registration steps, ticket, and lanyard.
- Travel photo wall, badge artwork, and responsive motion refinements.
- YouTube classroom playback, shared event clock, bounded rewind, lighting,
  and end-of-class dialog.
- Consent-aware tracking and registration relay to the existing CRM.
- Route/asset checks and automated classroom, registration, and tracking tests.

## Run locally

Use Node.js 22 or newer in this directory:

```sh
npm ci --ignore-scripts
npm run build
npm test
npm run dev
```

The local preview serves TIP at `/travelinginprofit/` and its classroom at
`/travelinginprofit/classroom/`. The documented build and all 49 tests passed
when this source handoff was prepared on November 11, 2026.

## Deployment boundary and current limitations

This commit is a GitHub source handoff, not an integration with the repository's
root Vite application or a production launch. Root deployment configuration is
unchanged. The existing private Sites project identity is retained in this
package. Do not deploy it over the existing root application without a separate
integration and deployment review.

The classroom schedule still contains the existing November 9 rehearsal date.
Production dates must be set before a class launch. Provider-backed email,
payment, community fulfillment, and software activation are not enabled here.
CRM forwarding needs the server-only bindings described in `CRM-INTEGRATION.md`;
no binding values are committed. Local submissions fail clearly when those
bindings are absent. Earlier README notes about purely browser-local intake and
the pending video predate the CRM and YouTube changes; use
`CRM-INTEGRATION.md` and the current source for those behaviors.
