# Mibo puppet prototype

A code-drawn, parametric Mibo to steer look and feel before the app and voice exist. Open `index.html` in a browser (no build step).

- `mibo-puppet.js` holds the character and has no DOM code, so it ports to React Native Skia + Reanimated:
  - **Rig:** `drawMibo(ctx, P)` draws Mibo from one flat parameter object (body squash, lean, gaze, eyelids, brows, mouth shape, arms).
  - **Presets:** `VISEMES` (teaching mouths) and `MOODS` are plain data.
  - **Puppet:** springs, idle life (breathing, blinks, glances, fidgets), one-shot moves (hop, wave, celebrate, wiggle, boop) and a script runner for talk segments. Talking uses a rough text-to-mouth-shape timeline as a stand-in until real TTS audio drives the mouth.
- **Two looks** from the same geometry: `style: 'clean'` (vector, 60 fps) and `style: 'sketch'` (watercolour washes, coloured-pencil lines, pencil hatching, paper grain). The page redraws the sketch stage at a hand-animation frame rate (default 12 fps) and cycles three wobble variants so lines boil. No canvas filters (iOS Safari lacks them); the same steps map to Skia path effects and shaders.
- `index.html` is the playground and A/B test: both styles side by side driven by one puppet, a blind round that shuffles sides and tallies votes in the browser, and a mouth editor that exports tuned shapes as JSON ("Copy my tuning").

Shapes and colours are traced from `assets/character/mibo-idle.png`. The eyebrows are new; they can be turned off on the page.
