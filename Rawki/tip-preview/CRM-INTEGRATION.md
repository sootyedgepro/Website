# Stream Line Agentic integration

The existing Site identity is preserved. The build now produces a Worker entry in `dist/server/index.js`, all existing website assets in `dist/client`, and the hosting manifest in `dist/.openai/hosting.json`.

The Worker serves the original routes through `env.ASSETS`. Its only writable route is `POST /api/streamline/events`. The collector URL and credentials are server bindings, never browser configuration:

- `CRM_COLLECTOR_URL`: the private CRM `/api/collect` URL.
- `CRM_SITES_AUTH`: the raw Sites bypass bearer token; the Worker adds the `Bearer ` prefix.
- `INGEST_SECRET`: the collector ingestion secret; the Worker adds the `Bearer ` prefix.

## Working capture

- Class registration is accepted by the CRM before the ticket completes or is saved locally. Failure preserves details and restores the stub for retry. The stable ticket event ID deduplicates interrupted submissions.
- The checklist request saves the lead and then opens the existing download page. It does not claim that an email was delivered. Educational marketing consent is a separate optional checkbox.
- Support saves the original request fields and shows its durable event reference. Contact consent is explicit; the technical-scope acknowledgment remains separate.
- The suite navigation again exposes the retained software details and real-chart walkthrough pages.

## Traffic measurement

Optional analytics default to off, are separate from the chart preference cookie, and honor Global Privacy Control. A Traffic preferences link is available on both sites. Consent creates random visitor/session IDs shared across their routes; withdrawal removes the IDs and campaign storage. There is no fingerprinting. Allowed measurements include page visits, CTA and checkout intent, form start, classroom entry, video start, quarter progress and completion.

Operational submissions are still saved without analytics consent, using an event-scoped ID with no campaign/referrer attribution. They must not be counted as consenting traffic. The backend receives this consent distinction. Contact details never go into analytics events, page-query strings, or local analytics storage.

## Explicit limits

Email delivery is still deferred. No external messages are sent. Checkout remains an intent preview; this integration never charges, claims a sale, or activates software. Old completed tickets already stored in visitors' browsers are not silently uploaded to the CRM. Production Airtable/MailerLite/Resend/Stripe history has not been imported.

## Verification

Build with `node build.mjs`; test with `node --test tests/*.test.mjs`. The portable preview uses `dist/client` and delegates the same-origin relay to the Worker implementation. With no local collector bindings, operational submissions return an honest unavailable response.

The automated tests cover consent gating, cross-site visitor continuity after opt-in, operational capture without analytics, idempotent event forwarding, strict same-origin relay input, payload limits, private header formatting, upstream failure handling, preserved nested routes/media, and the Worker artifact shape. A deployed authenticated collector round trip and browser form flows are final deployment checks.
