# Mibo puppet prototype

A code-drawn, parametric Mibo to steer look and feel before the app and voice exist. Open `index.html` in a browser (no build step).

- `mibo-puppet.js` holds the character and has no DOM code, so it ports to React Native Skia + Reanimated:
  - **Rig:** `drawMibo(ctx, P)` draws Mibo from one flat parameter object (body squash, lean, gaze, eyelids, brows, mouth shape, arms).
  - **Presets:** `VISEMES` (teaching mouths) and `MOODS` are plain data.
  - **Puppet:** springs, idle life (breathing, blinks, glances, fidgets), one-shot moves (hop, wave, celebrate, wiggle, boop) and a script runner for talk segments. Talking uses a rough text-to-mouth-shape timeline as a stand-in until real TTS audio drives the mouth.
- `index.html` is the playground. Its mouth editor exports tuned shapes as JSON ("Copy my tuning").

Shapes and colours are traced from `assets/character/mibo-idle.png`. The eyebrows are new; they can be turned off on the page.
