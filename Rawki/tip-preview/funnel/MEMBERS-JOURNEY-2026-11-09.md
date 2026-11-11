# Member windows and Journey badge — November 9, 2026

## Actual component provenance

The existing JavaScript + CSS React Bits CardSwap and Lanyard remain the rendered components. Their sources are retained under `shared/vendor/react-bits`, with the existing license notice. This pass adapts the site's content, layout and Lanyard's depth callback; it does not replace either component with an imitation. No new dependency was added.

Reference reviewed: `D:/Downloads/Bobby-Screenshot.png`. The original uniform photograph at `public/photos/zi-autozone.webp` was also inspected directly.

## Annotations 18–19: member windows

- Desktop cards now cap at 640×350px with a 34% screenshot / 66% details split, matching the reference's compact screenshot-left/profit-right arrangement. Compact cards retain 294px height and use a 42/58 split for readable text.
- The internal deck/grid/stage wrappers now allow visible overflow. The entire `#clients` section remains the clipping boundary, so a dragged window is no longer cut off at the small invisible stage rectangle.
- Existing original screenshot nodes, trade text, totals, dates, quotes and full-image viewer links remain unchanged. The prior right-padding-only presentation trims remain; no screenshot or trade data is mirrored.
- Native CardSwap drag/swipe, exposed back-window selection and arrow keys remain. Reduced motion retains static cards and internal previous/next controls.

Files: `shared/member-results.jsx`, `shared/member-results-source.css`, and the bounded-drag adaptation in `shared/vendor/react-bits/CardSwap.jsx`.

## Annotations 14–16: Journey badge

- The front header is moved below the physical card slot, with a safe text width. Orange double edging and short diagonal accents add detail around the photograph.
- The inspected uniform selfie has reversed name/logo text. Only that portrait's draw operation is reflected horizontally inside the composed front texture. The original image file is unchanged; all newly drawn header/name text is rendered after the canvas reflection has been restored.
- The reverse has a diagonal/halftone pattern, the retained 9–5 message and a hand-tagged `RAWKI was here` sticker illustration.
- The canvas now measures the complete `#journey` section viewport. Its anchor is recalculated to retain the original desktop landing position; the left swing is no longer clipped at the inner content wrapper.
- The visible instructions/actions box is removed. A native, focusable button on the badge still invokes the same physical flip on Enter/Space. It is not disabled or removed from tab order; pointer-events are disabled only for the WebGL overlay so pointer/touch events reach the section's existing raycast handlers. In the static fallback the button accepts taps normally.
- A local `onDepthChange` Lanyard callback uses physical Z position with hysteresis to switch the section layer naturally. Active dragging keeps the card in front; it can pass behind surrounding copy when swinging away.
- The November 8 touch-control guard, pointer capture cleanup, cursor restoration, delegated listener dependency and font-ready unmount guard remain.

Files: `shared/funnel-lanyards.jsx`, `shared/funnel-lanyards.css`, `shared/vendor/react-bits/Lanyard.jsx`. Registration mounting and its component contract are unchanged. Section backgrounds are imported from the root agent's new `funnel-atmosphere.jsx`.

## Validation

Both member and Journey adapter entrypoints bundled successfully using esbuild in memory after the atmosphere module was available. Original image/reference review and the keyboard/capture/lifecycle checks above are source inspections. Root-agent desktop/mobile runtime validation and publication are separate; neither is claimed by this note.

## Follow-up source audit

- The initial CSS-only section boundary allowed cards to be dragged out of view. An optional `dragBoundary="#clients"` now clamps the rotated card footprint to that entire section while held, with 6px edge clearance. Bounds and stage origin are read in viewport coordinates on each move, so page scroll/reflow do not reuse stale page coordinates.
- Gesture displacement is tracked separately from the visible clamp: narrow-phone horizontal swipes can still advance even when the card has little physical room to move. Normal post-release departure/reordering animation remains native CardSwap.
- Active pointer ownership is retained; additional touches cannot replace it. Cancellation/lost capture returns the card to the stack. Cleanup releases remaining pointer capture and restores the root cursor.
- Member card text selection is disabled to prevent dragging from selecting the header. The separately rendered full-image viewer is unaffected.
- Badge focus and static fallback force the scene in front for a visible keyboard focus indicator. The section-width observer ignores zero-width transitional layouts and disconnects on unmount. Lanyard's asynchronous image load already checks its live flag and request token before updating disposed textures.
- Source follow-up and in-memory compilation are distinct from root-agent runtime checks.
