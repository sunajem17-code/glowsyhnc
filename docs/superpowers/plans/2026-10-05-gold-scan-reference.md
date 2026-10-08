# Gold Scan Reference Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task. Execution is authorized in the user's request; do not commit or push.

**Goal:** Recreate the supplied purple scan presentation in gold, adapting geometry to the detected face.
**Architecture:** Keep the existing AnalyzingScreen shared by Scan and PremiumOnboarding. Replace its clock, portrait geometry, and callout rendering; retain capture, validation, API calls, and result navigation. One normalized image transform registers every layer.
**Tech Stack:** React, SVG, CSS, existing MediaPipe landmarks, Node test runner.
**Spec:** Reference measurements below, from 663236BE-BA88-440F-9475-E894B326A11B.mov (14.231667 seconds, 1206×2622, 60 fps).

## Global Constraints
- Local camera capture stays unchanged.
- Gold replaces purple; retain the reference's dark surroundings, delicate mesh and persistent callouts.
- No commits or pushes.
- Never infer real measurement accuracy from a decorative animation percentage.
- Missing landmarks must not produce invented facial geometry.
- A video supports visual reconstruction, not a guarantee of original source-code equivalence or perfect tracking on every face.

## Reference measurements
Sampled every 250ms across the complete recording, with enlarged cheekbone/jaw/cheek frames.
Photo spans approximately x=12.2%..87.8%, y=14%..89.7% of the recording. Its aspect is 333:723.
Callout centers in portrait coordinates: chin (95%,74%), cheekbone (5%,30%), jaw (95%,52%), cheek (5%,62%), submental (95%,30%).
Circle diameter is about 16.8% of photo width. Thin connectors terminate in white dots. Completed circles retain a white check and saturated accent fill.
0–1.3s: narrow luminous vertical sweep, low-opacity full-face mesh, undimmed image.
1.3–3.4s: chin glow, darkened background, first percentage/check.
3.4–5.7s: paired upper-cheek wedges below eyelids; soft broad glow, brighter edge.
5.7–8.2s: jaw contour trace, briefly restore brightness at stage entry then dim.
8.2–10.7s: curved bilateral cheek panels, brightest along outside edges.
10.7–13.34s: lower chin contour, persistent earlier checks.
13.34–14.23s: compilation/end; video does not show the complete subsequent results screen.
The reference occasionally displays >100%; production percentages will clamp at 100.
Colors: gold #C6A85C base, #E0C988 edge, #FFF0BE core. Keep relative glow/dimming rather than swapping all pixels to yellow.

## Review Focus
1. API arriving mid-animation must never restart playback.
2. Portrait/landmark delays must not skip the intro; wait for both.
3. Off-center, wide, rotated, mirrored faces must share image/overlay transform.
4. Labels must escape all photo/parent clipping; render a viewport overlay portal.
5. Missing points and narrow screens must not create NaNs, shift stage identities, or clip labels.

## Tasks
- [ ] 1. Geometry: add scanReferenceGeometry.js defining stable five features from measured named points and optional jaw contour. Use interpolation along each face's own eye/cheek/jaw basis for bilateral shapes, not screen-fixed ellipses. Test transformations and missing points.
- [ ] 2. Timeline: preserve SCAN_STARTS and derive stage-local progress, entry dimming, and compilation from elapsed time. Clock effect depends on photo/landmark readiness only. Complete its callback once; existing callers already await real analysis separately. Test early/late response independence.
- [ ] 3. Portrait: replace existing ScanPortrait with static memoized mesh, focus mask, small regional glow, and shared geometry mapping. Remove unregistered fixed-radius face ellipse. Use body portal with ResizeObserver/scroll/viewport updates for callouts. Only percentage text changes each tick.
- [ ] 4. Styling: replace scanReference.css with narrowly scoped styles for portrait, glow, callouts, stage intro and reduced motion. Reserve screen gutters, preserve reference circle/text proportions, no photo container query clipping.
- [ ] 5. Verification: node --test on geometry/timing; production build; development preview using detected landmarks and real bundled face photos, selectable timestamps; browser screenshots. Verify server serves edited source, preserve live reload. Report actual coverage and physical-device limitations.

## Deployment
Client-side only. Development changes are served by the existing live-reload server. A standalone bundled device install still requires npm run build, npx cap sync ios and Xcode Run. Do not overwrite the active live-reload configuration during testing.

## Execution record — 2026-10-06
- Geometry, timeline, portrait and styles implemented in the existing shared presentation.
- Five Node regression tests pass; production build passes.
- Browser preview inspected at 402×874 using both bundled faces and the user's IMG_2250.jpg, loaded through a local file chooser. No scoring API call.
- Playback with photo URL conversion during stage four reached COMPILING RESULTS and completed exactly once.
- Independent review found photo-key remount risk; removed key based on photo representation.
- Zero-size portal measurements are now guarded. Preview hot-reload root is retained.
- Local HTTP check returns 200 at http://10.103.71.184:5174.
- Physical deployment pending: devicectl reports iPhone unavailable and Capacitor lists only simulators. Earlier installed live-reload URL uses the previous network address and needs reinstalling.
- Not yet established: pixel-perfect equivalence, physical iPhone frame rate, all face/detection conditions, and final small-screen acceptance.
- Ruling: preserve the user's active working folder and live-reload workflow rather than isolate into another checkout; no commits or pushes. All existing camera and HairMax changes remain.
- Ruling: progress percentages clamp at 100 although the reference briefly overshoots it.
