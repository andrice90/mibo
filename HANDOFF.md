# Handoff: voice locked, puppet Mibo chosen, next is the Expo app

Written 2026-10-28 at the end of a cloud session, for the next session (one with the EAS CLI). Read this first, then `PROJECT.md` decisions #37, #45 and #46.

## Where the work is

- **Branch:** everything is merged into `main` (from `claude/tts-eval-judge-ig4j9t`). Start new work from `main`.
- **Hackathon deadline:** submit by Wed Nov 4, 9:00 PM ET (PROJECT #29).
- There is no `app/` folder yet. The Expo app has not been scaffolded.

## What was decided this session

| Topic | Decision | Where it's written |
|---|---|---|
| Voice | **Gemini 3.8 Flash TTS via OpenRouter, voice Leda** (`google/gemini-3.8-flash-tts`, `voice: "Leda"`, delivery note in `instructions`). One voice for talk and teaching clips. | PROJECT #37, `docs/06` §5.2 |
| Character | **Code-drawn puppet Mibo in a hand-drawn style:** watercolour washes, coloured-pencil lines, pencil hatching, paper grain. Picked over a clean vector look in a blind A/B. | PROJECT #46, `docs/03` §0 |
| Motion timing | Held like hand animation because smooth motion looked fake: **body 6 fps, mouth 24 fps, line boil 3 fps.** One config, `Mibo.STYLE`, and it must stay tunable. | PROJECT #46 |
| App stack | Stay on Expo (founder has no Mac). Character drawn with React Native Skia + Reanimated, not Rive. | PROJECT #8/#9, `docs/02` §1 |

## What exists

- **`prototypes/mibo-puppet/`**: the character. Open `index.html` in a browser, no build step.
  - `mibo-puppet.js` has no DOM code, written to port to Skia. It holds:
    - **Rig:** `drawMibo(ctx, P, opts)`.
    - **Pens:** `CleanPen` and `SketchPen`.
    - **Presets:** `VISEMES`, `MOODS`, `STYLE`.
    - **Animator:** `Puppet`, with springs, idle life, moods, moves, the script runner and `mouthKey`.
  - `index.html` is the lab: sliders for timing and feel, a mouth shape editor, the mini /s/ lesson, and the blind A/B test.
  - The 6/24/3 fps holds live in the lab's render loop (`holdPose`, `holdMouth`, boil clock), not in the module. The app needs the same three clocks.
- **`tools/tts_eval.py`**: the TTS bake-off.
  - Usage: `OPENROUTER_LLM_API_KEY=... python3 tools/tts_eval.py --models gemini-3.8-flash-leda --clips iso-th`.
  - It includes `analyze()` and `mouth_track()`, a prototype of audio-driven mouth shapes.
  - Self-test: `python3 -m unittest tests.test_tts_eval`.
  - Output in `eval/tts/out/` is git-ignored.
- **Docs:**
  - `docs/06-live-voice-and-tts.md`: the live-voice design, the bake-off results table, and the voice decision with latency mitigations.
  - `docs/03` and `docs/02`: updated for the puppet.

### Live pages (private claude.ai artifacts, owner-only until shared)

Both web demos are also in the repo and open straight from disk:

- Puppet lab: `prototypes/mibo-puppet/index.html`, also at https://claude.ai/artifact/PwZby3a2fYUwLHQgojPQwf.
- Voice bake-off listening page: `prototypes/voice-bakeoff/index.html`, with all 228 clips as MP3, also at https://claude.ai/artifact/22YqYEpaHxaLwNefHvn1Ha.

## Next: Mibo speaks with Leda, in the app

Goal for the next session: the puppet on an iPhone, speaking Leda audio, with the mouth following the audio.

1. **Scaffold the app** in `app/` (Expo + TypeScript, `expo-dev-client`, EAS iOS development profile), per `docs/02` §3. Install it on the founder's iPhone through an EAS development build.
2. **Port the puppet to Skia:**
   - Move `mibo-puppet.js` into the app as TypeScript.
   - Swap `CanvasRenderingContext2D` calls for Skia: `Path`, `Paint`, and clip ops.
   - The hand-drawn pieces map to Skia directly: the wobble is plain point math, the grain and pencil textures become image shaders, and the washes are alpha fills plus multiply blend.
   - Keep `Mibo.STYLE` as the single timing config, and keep the three clocks.
3. **Make the voice call from a server, not the app:**
   - A small Cloudflare Worker per `docs/02` holds the OpenRouter key and calls `POST /api/v1/audio/speech` with `{ model, input, voice: "Leda", instructions: MIBO_STYLE, response_format: "pcm" }`. Copy `MIBO_STYLE` from `tools/tts_eval.py`.
   - Gemini returns 24 kHz mono PCM. The app plays it with `react-native-audio-api` or similar (to verify).
4. **Drive the mouth from the audio:**
   - Port `analyze()` and `mouth_track()` from `tools/tts_eval.py`, but emit Mibo's viseme keys (`ah`, `ee`, `oh`, `oo`, `eh`, `s`, `sh`, `f`, `mbp`, `rest`) and feed them to the puppet as `mouthKey`.
   - The 24 fps mouth clock then picks the shape held longest per frame, exactly as the lab does with the text-based timeline.
5. **Cover the 2.6 s wait** (`docs/06` §5.2): thinking pose plus a bundled "Ooh!". Synthesise the first short segment on its own. Bundle common lines as pre-generated Leda audio.

### Also open

- Gemini TTS licence terms for app and public demo use (PROJECT open items).
- Generate and check the /s/ teaching clips with Leda. /θ/ and /z/ need several takes; record /θ/ as the phrase "Thhhh... thumb!" and trim it (`docs/06` §5.2).
- Meta Model API terms check and the on-device speech recogniser spike are still open from `docs/02`.

## Environment notes

- **OpenRouter:**
  - The key must be an inference key, read from `OPENROUTER_LLM_API_KEY` (or `OPENROUTER_TTS_KEY`). Never commit it.
  - Credit was about $2.37 at handoff. Leda TTS costs about $0.012 per minute of speech.
  - The `--judge` IPA pass cost about 3¢ per clip, and its "clear" verdicts lean toward the intended text, so trust only its "not clear" ones.
- **Cloud containers:**
  - They could not run a Cloudflare quick tunnel: outbound traffic is HTTPS only, through a proxy.
  - Share pages as claude.ai artifacts instead, or run tunnels locally.
- **The lab saves slider tuning in each browser** (`localStorage` key `mibo-style-ab-v3`). To turn a tuning into a default, press "Copy my tuning" and paste the values in.
