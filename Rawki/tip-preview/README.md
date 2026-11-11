# SootyEdge and Traveling in Profit Site

Private owner preview: https://sootyedge-interactive-suite.rawki.chatgpt.site.

Both experiences are hosted by this one Sites project:

- `/` — SootyEdge suite and interactive chart.
- `/travelinginprofit/` — Traveling in Profit class funnel.
- `/travelinginprofit/classroom/` — test video player and simulated chat.
- `/travelinginprofit/privacy/` — funnel privacy page with preview context.

The funnel source lives in `funnel/public` and `funnel/shared`. Its assets, component bundle and configuration are namespaced under `/travelinginprofit/` so they cannot overwrite SootyEdge. Companion links stay on the same origin. The registration flow is a browser-only preview: it sends no emails or registrations. The classroom contains a test clip and local video picker until the class recording is supplied.

## Source and editing

- `shared/marketing.mjs` renders the page structure; `shared/marketing.css` retains shared brand styles.
- `shared/suite-demo.mjs` and `shared/suite-bubbles.css` implement the single grid-free chart, working toolbar, cookie gate and floating guide.
- `shared/navigation.jsx` mounts React Bits CardNav with suite, learning and support links.
- `shared/suite-guidance.jsx` and `shared/suite-guidance.css` provide the visible introduction and the included-access/setup section around the chart. React Bits AnimatedContent supplies a restrained reveal of the setup section.
- `shared/offer.jsx` and `shared/offer-source.css` implement the single license card using React Bits TiltedCard. The former feature-list/product panel has been removed.
- `shared/guide-light.jsx` adds React Bits GlassSurface and a decorative SpecularButton rim to the chart guide. `shared/guide-glass.css` styles the glass layer.
- `shared/ui.jsx` bundles the navigation, introductory guidance, purchase section and guide effects as isolated React components.
- `shared/consent.mjs` gates the chart. Cookie preferences remain available below the chart and in the footer.
- `public/` contains the captured public baseline, local assets and transparent logo.
- Add `?review=1` to the page URL for the baseline comparison and owner-feedback controls.

`shared/tradingview-widget.mjs` is retained legacy source; the current page does not import or mount a separate TradingView iframe.

## Run

Use Node 22 or later. Run `npm install` once, then `npm run dev` (http://localhost:3002).

- `npm test` runs the data, calendar, input and cookie checks.
- `npm run build` copies both experiences and bundles their separate React interfaces. `node --test tests/hosting.test.mjs` checks the built routes, configuration, assets and classroom video serving after a build.
- Sites serves `dist/` as declared in `.openai/hosting.json`. Preserve the project ID and owner-private audience.

On this Windows host, install scripts were disabled to avoid the npm shell's Node-path issue. Esbuild's installed optional platform binary was verified by earlier successful builds. Current revision validation is tracked in `QA-2026-11-07.md`.

## Visitor guidance

The introduction explains the three types of chart context, who the software is intended for, and how to start the chart guide. After the demo, the getting-started section explains what the personal license includes and the path from purchase to receiving access: exact TradingView username, verified payment, one-business-day activation, setup documentation and technical support. It also offers the free class for visitors who want to learn the process before purchasing.

These sections lead into the existing price card without restoring the removed repeated product-feature panels. TradingView account requirements, possible platform fees and the distinction between analysis and trade execution remain explicit. AnimatedContent uses a one-time 18px reveal lasting 0.55 seconds; reduced-motion users receive the content without that animation.

AnimatedContent is the official JavaScript + CSS registry source retrieved November 7, 2026. It has no companion component stylesheet and requires `gsap@^3.13.0`; `package-lock.json` resolves GSAP to 3.15.1. Source identity and licensing are recorded in `REACT-BITS.md`.

## Chart behavior

One TradingView Lightweight Charts canvas contains the SootyEdge visual demo. Flow Tracker, Action Zones and Tunnel Bands arrive in sequence on the same chart. There is no separate market-chart tab or iframe.

The compact toolbar provides one-hour/four-hour examples, genuine Candles/Bars rendering choices, zoom, reset, guide replay and chart information. Panning, keyboard navigation and zoom pause the guide. Visitors can hide, resume or replay it; reduced motion uses manual progression. Style changes preserve the visible range. Timeframe changes retain the guide chapter and displayed layers while resetting the chart view. Resizing preserves the visible time range.

GlassSurface sits inside the existing speech bubble; SpecularButton supplies its decorative edge. Both layers leave the native guide controls usable. Reduced-motion and hoverless inputs use quieter glass styling. The TiltedCard purchase surface likewise has a static fallback, and its native purchase button opens the existing review dialog.

Cookie revocation removes chart canvases and guide effects, stops guide timers, and keeps the chart locked after reload. No separate external market embed is loaded.

## Market data and indicator boundary

The visible **Demo prices** label is intentional. Candles are synthetic, the overlays are illustrative reconstructions, and the current application does not contain the owners' private indicator calculations or an authorized live market-data feed. The chart information control states this directly.

TradingView widgets cannot run custom Pine scripts or provide their price data to this chart. Advanced Charts supports custom JavaScript indicators but does not supply market data; access and licensing requirements also apply. A production chart combining actual market prices and the proprietary suite requires the owners' authorized indicator implementation and a compatible data feed with suitable display rights. Replacing the candles alone would not make the present illustrative overlays authentic.

The purchase and activation flow remains a demonstration. No payments, emails or activation requests are sent. Companion class links go to `/travelinginprofit/` on this Site.

## Sources

- [TradingView widget scripting limitations](https://www.tradingview.com/widget-docs/faq/general/)
- [TradingView widget data limitations](https://www.tradingview.com/widget-docs/faq/data/)
- [Advanced Charts custom indicators](https://www.tradingview.com/charting-library-docs/latest/custom_studies/)
- [Advanced Charts integration requirements](https://www.tradingview.com/charting-library-docs/latest/quick-start/)
- `REACT-BITS.md` records component sources and licensing.
- `QA-2026-11-07.md` records verification status and remaining checks.

## Transparent logo

`public/sootyedge-icon.png` was produced with the built-in image generation tool from `public/sootyedge-mark.png`.

Prompt: Remove only the black background and negative spaces. Preserve the gold S, compass points, candlesticks, geometry, colors, highlights and proportions. Add no effects. Return a truly transparent background.

The alpha PNG was inspected. The cutout has small generative bevel/edge differences, so retain the original for exact brand-source work.
