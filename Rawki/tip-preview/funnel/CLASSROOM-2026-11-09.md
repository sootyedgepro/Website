# Classroom update — November 9, 2026

## Visitor and owner views

Before the scheduled class, /travelinginprofit/classroom/ shows the heading and countdown only. At the scheduled start, the player and connected conversation window become available. Joining late, returning after a pause, or returning from another browser tab uses the current scheduled recording position. There is no seek timeline or separate native control bar. After the event ends, playback is unavailable and the page points visitors toward the tools and class details.

The actual class recording has not been supplied. Configure its hosted URL on the classroom main element using data-recording-src. Until then, the regular event view says the recording is not ready; it never presents the sample clip as the class.

Owner testing is available at /travelinginprofit/classroom/?preview=1. This explicit mode bypasses the date and plays the existing Big Buck Bunny sample. The information disclosure contains its attribution and local file picker. A chosen local video is never uploaded, and its object URL is revoked on replacement or unmount. This query parameter is a testing convenience, not an authentication mechanism.

## Requested components

- PromptBar: actual React Bits JS + CSS source, verified against PromptBar-JS-CSS.json in D:/Programs/Web Development/ReactBits/registry. Existing motion and Hugeicons dependencies satisfy its requirements.
- LightRays: actual React Bits JS + CSS source, verified against LightRays-JS-CSS.json in the same registry. It has no new dependency.
- WakeSlider remains the actual previously installed React Bits component and controls the video element's volume directly.

Both newly copied components matched their registry contents after newline normalization. Existing project React Bits notices apply. The official customized demo URLs were attempted through the text browsing tool, which could not open them; the local current registry and source were inspected instead.

PromptBar uses the requested placeholder, dark background, white text, blue spark color, 0.8 spark boost, 180 ms morph, 0.93 press scale, 4-degree glyph tilt and four-row maximum. The demo's model/effort switches map to empty arrays in the component API; dictation is omitted. Small source adaptations add a meaningful input label and length limit, hide the sources button when there are no sources, and suppress irrelevant empty token menus. No AI, attachment, microphone or chat backend is connected.

LightRays uses bottom-center origin, gold #eab308, spread 0.7, density 1.7, glow 0.4, intensity 1.2, noise 0.14, fade 0.8, haze 0.55, length 2.6, sharpness 0.65 and speed 0.8. The cathedral URL values are expanded into real props, not an invented preset prop. Device pixel ratio is capped at 1.5. Reduced motion, page visibility and the existing motion event pause animation and cursor response.

## Interaction and visual structure

Desktop places conversation beside the flush video in one rounded shell; narrow screens place it below. One overlay inside the video supplies play/pause, mute, WakeSlider and full screen. Controls remain available on touch and keyboard focus. The removed demo bars, explanatory chat toolbar and duplicate controls are gone.

One discreet information disclosure explains that the conversation is simulated and that typed messages stay in the local browser. Incoming example messages follow playback and do not claim trading outcomes, audience size or real attendees. The local message list is bounded and preserves the reader's scroll position unless they are already following the latest messages.

The golden rays use their actual cursor-shadow shader. Opaque foreground panels stop the background light visually; their pointer-following edge reflection and directional shadows add the requested hover response. This is a composed visual approximation of light occlusion, not physical ray tracing or DOM geometry passed into the shader.

## Verification

- JSX/CSS syntax transforms: passed with no warnings.
- Combined build: passed using node build.mjs. The npm launcher in this shell could not resolve node, so the script was run directly.
- Full test suite: 14/14 passed. The existing localhost hosting test required execution outside the network sandbox; its initial sandbox failure was EACCES, not an application assertion.
- New schedule tests cover exact start/end boundaries, late joining, returning from pause, short recordings, owner test bypass and invalid dates.
- Parent integration handles desktop/mobile browser checks and deployment. Actual class recording playback cannot be verified until that recording is supplied.
