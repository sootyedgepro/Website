# React Bits integration

Current integration: November 7, 2026. Component source and companion CSS are retained under `shared/vendor/react-bits/`.

## Components currently mounted

| Component | Application | Official JavaScript + CSS source |
| --- | --- | --- |
| CardNav | Header navigation with expanding suite, learning and support cards | https://reactbits.dev/r/CardNav-JS-CSS.json |
| GlassSurface | Refractive glass surface inside the chart guide | https://reactbits.dev/r/GlassSurface-JS-CSS.json |
| SpecularButton | Decorative pointer-following edge around the guide | https://reactbits.dev/r/SpecularButton-JS-CSS.json |
| TiltedCard | Single SootyEdge license and purchase card | https://reactbits.dev/r/TiltedCard-JS-CSS.json |
| AnimatedContent | One-time reveal of the included-access and setup guidance | https://reactbits.dev/r/AnimatedContent-JS-CSS.json |

React and React DOM render these isolated components; esbuild bundles their shared UI entry. CardNav uses `@hugeicons/react` and `@hugeicons/core-free-icons`. AnimatedContent requires `gsap@^3.13.0`; the lockfile currently resolves GSAP to 3.15.1. The earlier SpotlightCard and StarBorder files are retained as source but are no longer mounted in the current purchase section.

### AnimatedContent source identity

The official `AnimatedContent-JS-CSS` registry entry was retrieved on November 7, 2026. The registry does not declare a component semantic version, so the retained source is identified by retrieval date and SHA-256: `f18acb24614948733f8351479f03a06d3052ddacfb291e4cbaccead58499bab2`. Its `AnimatedContent.jsx` source is unmodified. This variant contains no companion CSS file; page-specific layout lives in `shared/suite-guidance.css`.

## Application

- **CardNav:** A glass header opens on click, with restrained rising cards and a gold purchase link. Its links point to the working suite, offer, class, checklist, support and policy destinations. Intro animation is disabled.
- **GlassSurface:** The glass layer is mounted inside the existing chart bubble, without adding a rail or reserved layout height. Reduced-motion and hoverless media preferences disable refraction; a frosted fallback remains.
- **SpecularButton:** The only component-source adaptation is an optional polymorphic element prop; its default remains a native button. The guide renders an aria-hidden decorative `div`, so its existing controls are not nested in a button. The rim has no pointer hit target, body fill or idle rotation and follows the responsive bubble radius. Reduced-motion and hoverless inputs omit the WebGL rim.
- **Guide lifecycle:** The decorative React mount is cleaned up on dismissal, consent revocation, chart recreation, page hiding and teardown. Restoring the guide recreates it. Component cleanup releases its observers, listeners and rendering resources.
- **TiltedCard:** The offer is now a single license card with restrained tilt, gold glare and its price and purchase action on the card face. The redundant feature-list/product panel has been removed. Tooltip, flipping, floating, intro and gyroscope behavior are disabled.
- **Offer fallback:** Reduced-motion and hoverless inputs use static markup. The semantic purchase button retains keyboard focus styling and the existing owner-review purchase callback. No payment or activation service is connected by this visual integration.
- **AnimatedContent:** Only the post-chart getting-started section animates. It rises 18px over 0.55 seconds once when entering view, with no blur, rotation, scrubbing or repeated disappearance. The introduction remains immediately visible. The upstream component skips its animation for reduced motion and uses GSAP context cleanup to remove its timeline and ScrollTrigger on unmount.

The glass and tilt settings adapt to media-preference changes. No camera or device-motion permission is needed by these SootyEdge integrations. The chart remains one Lightweight Charts experience with clearly labeled illustrative prices and layers.

## License

The upstream MIT + Commons Clause license and 2026 David Haz copyright are retained verbatim in `shared/vendor/react-bits/LICENSE.md`.

Upstream license: https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md

These components are incorporated into this website; they are not offered for sale as a standalone component product.

## SideRays atmosphere — November 7, 2026

The JavaScript/CSS SideRays source was copied from the verified local React Bits registry (`SideRays-JS-CSS`, current November 7 snapshot). Its source remains intact in `shared/vendor/react-bits/SideRays.jsx` and `.css`; existing upstream license applies. No additional dependencies were required.

`shared/suite-atmosphere.jsx` mounts one decorative, pointer-transparent background behind the complete suite page. Gold rays (#e7be66) blend with muted blue (#6b9dbe), with restrained dust and a top-right origin. Narrow screens use lower intensity, opacity and pixel density; pointer following is disabled. Reduced motion uses a static frame and no intro. The source suspends animation offscreen/hidden and releases its rendering resources on unmount.

Desktop and 390px browser review confirmed the rays render behind readable page content without horizontal overflow. The existing chart, guide, consent and purchase controls are retained. Reduced-motion lifecycle was reviewed in source; browser emulation was not available for that preference.

## Verification

See `QA-2026-11-07.md` for the current implementation and browser-validation status. Earlier checks of the previous offer and two-tab chart are historical and do not certify this revision.
