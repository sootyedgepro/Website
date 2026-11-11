# Member windows and agenda reveal — 2026-11-08

## Scope and source

This pass changes only the hosted funnel member/agenda adapters, their scoped CSS, and the existing customized React Bits FlowingMenu implementation. The actual CardSwap and FlowingMenu JavaScript + CSS implementations remain in use. Source authority is the local React Bits library at `D:/Programs/Web Development/ReactBits`, including `registry/CardSwap-JS-CSS.json` and `registry/FlowingMenu-JS-CSS.json` (registry snapshot fetched November 7). Existing upstream notices remain in `shared/vendor/react-bits/LICENSE.md`. No dependencies were added.

## Member CardSwap

- `shared/member-results.jsx`: desktop window cap reduced from 880×370 to 720×324; compact windows reduced from 320 to 294px high. Width remains responsive to the actual container.
- Raised rows are separated by 45px desktop / 34px compact. Stage height reserves the complete two-row rise, component padding, and 32px breathing room. The scoped stage contains the animated stack. No negative margins pull cards under the heading.
- `shared/member-results-source.css`: 880px maximum deck container, explicit 30px separation after the heading, isolated bounded stage, slightly tighter details spacing and amount typography.
- Presentation crops use CSS geometry around the original image node. They remove only blank right-side Discord padding; they do not rewrite or crop image files, trade history, totals, post text, or reaction content. The original anchor and original viewer handlers remain intact.

| Original file | Full dimensions | Presented right boundary |
| --- | --- | --- |
| mike.webp | 756×762 | 500px |
| cultracurrency.webp | 768×810 | 574px |
| bobby.webp | 724×802 | 424px |
| chris-gray.webp | 758×650 | 674px |
| lt.webp | 1166×372 | Full width |
| chris-silver.jpg | 1320×1960 | Full width |

All six originals were inspected before setting these presentation bounds. LT and Chris Silver have content extending across the image, so no right crop is applied.

Existing controls remain: clicking an exposed window, dragging/swiping, and keyboard arrows. Reduced motion retains the static card with internal previous/next controls. There is no external controls footer.

## FlowingMenu

- `shared/agenda.jsx` enables the local `revealFrom="center"` extension with `duration={0.64}` and `stretch={0}`.
- `shared/vendor/react-bits/FlowingMenu.jsx` adds a center-origin mask on both axes. Openness follows smoothstep ease-in-out (`p²(3−2p)`); leaving reverses the current progress toward the same center rather than restarting from an edge.
- Moving between rows keeps the upstream carried-content transition and title marquee. Existing full-photo background and opposing description rails are unchanged.
- Pointer, keyboard focus and first-touch preview use the same reveal. The second tap follows the link. Pointer cancellation reverses the preview.
- Reduced motion jumps to the selected state and existing CSS stops the title/description movement. Existing offscreen/document-visibility pauses and unmount cleanup remain.

## Verification

- Both changed adapter entrypoints bundled successfully using esbuild in memory on November 8.
- Runtime review found the baseline image link's 400px minimum height overriding the compact frame. The scoped link now explicitly resets both minimum dimensions to zero; root-agent rebuild and visual recheck follow this fix.
- Source audit confirms the original image URLs and DOM nodes are retained, the center mask cannot expand outside its menu, progress reverses from its current value, and reduced-motion/offscreen/unmount handling remains connected.
- Desktop 989/1331px and mobile 390px browser checks are assigned to the root agent. This note does not claim those runtime checks have completed.
