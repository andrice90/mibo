# Mibo puppet prototype

A code-drawn, parametric Mibo to steer look and feel before the app and voice exist. Open `index.html` in a browser (no build step).

- `mibo-puppet.js` holds the character and has no DOM code, so it ports to React Native Skia + Reanimated:
  - **Rig:** `drawMibo(ctx, P)` draws Mibo from one flat parameter object (body squash, lean, gaze, eyelids, brows, mouth shape, arms).
  - **Presets:** `VISEMES` (teaching mouths) and `MOODS` are plain data.
  - **Puppet:** springs, idle life (breathing, blinks, glances, fidgets), one-shot moves (hop, turn around, wave, celebrate, wiggle, boop; turning flips which arm is in front) and a script runner for talk segments. Talking uses a rough text-to-mouth-shape timeline as a stand-in until real TTS audio drives the mouth.
- **Two looks** from the same geometry: `style: 'clean'` (vector, 60 fps) and `style: 'sketch'` (watercolour washes, coloured-pencil lines, pencil hatching, paper grain). The page holds each sketch drawing like hand animation. Chosen timings (PROJECT #46) live in `Mibo.STYLE`: body, eyes and particles at 6 fps; the mouth swapping shapes over the held body at 24 fps, each frame showing the shape held longest in its window; and lines boiling at 3 fps, reusing the held pose. The lab's sliders tune them. No canvas filters (iOS Safari lacks them); the same steps map to Skia path effects and shaders.
- `index.html` is the playground and A/B test: both styles side by side driven by one puppet, a blind round that shuffles sides and tallies votes in the browser, and a mouth editor that exports tuned shapes as JSON ("Copy my tuning").

Shapes and colours are traced from `assets/character/mibo-idle.png`. The eyebrows are new; they can be turned off on the page.
