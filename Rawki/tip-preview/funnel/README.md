# Traveling in Profit hosted preview

This folder carries the current `local-review/apps/travelinginprofit/public` page and its shared React enhancements onto the existing SootyEdge Sites domain, under `/travelinginprofit/`.

- `public/` contains the home, classroom and privacy pages, existing images, fonts, lanyard artwork and sample classroom video.
- `shared/` is served at `/travelinginprofit/review/`. The root build bundles `funnel-ui.jsx` into `funnel-ui.js` and its companion CSS there. Generated local bundles were excluded from this source copy; vendor source and license files remain included.
- `shared/review-config.json` uses same-origin base URLs. The review module fetches it relative to its own module URL. Links back to SootyEdge resolve to `/`; classroom and privacy links stay inside `/travelinginprofit/`.
- Registration, reminder preferences, review controls and simulated chat are browser previews. They do not send email, reserve a seat, upload files or contact a registration API. Native source forms use `method="dialog"` so a failed JavaScript load cannot POST the user's entries.
- The classroom's supplied sample clip and local recording picker remain available. The actual class recording is still pending.
- `shared/calendar.ics` is a static fallback. JavaScript calendar downloads use the same event model, with the hosted classroom URL. The review date remains November 14, 2026 at 12:00 PM Eastern; this is an owner-review schedule, not a confirmed reservation.
- The privacy page retains the proposed production policy with a prominent owner-preview note explaining this hosted preview's actual behavior.

For a later source refresh, preserve the `/travelinginprofit/` asset and route prefix, same-origin configuration, browser-only preview behavior and static calendar fallback. Rebuild through the root project rather than serving unbundled JSX directly.
