# Handoff: Lesson 1 runs in Expo Go

Updated 2026-10-28 at the end of the session that built the app. Read this first, then `PROJECT.md` #37, #45, #46 and #47, then `app/README.md`.

## Where the work is

- **Branch:** `main`.
- **Hackathon deadline:** submit by Wed Nov 4, 9:00 PM ET (PROJECT #29).
- **App:** `app/` is an Expo SDK 58 app that runs in Expo Go. Run `npm run tunnel` in `app/`, then scan the QR code.

## What exists now

- **Lesson 1, /s/ then /θ/:**
  - hello, then a mouth warm-up
  - the snake sound, then sun, sock, soap, seal
  - the tongue sound, then thumb, three, think
  - a celebration
- **The grown-up taps** "Got it" / "Still tricky" / "Skip" after each try. There is no recogniser in Expo Go (PROJECT #47).
- **Each try runs:** "Watch my mouth", then the model clip (zoomed on the mouth), "Can you say it?", the listening pose, the tap, a quick "Ooh!" / "Hmm!", and the live reply. Up to 2 re-models, then Mibo moves on.
- **Live replies:**
  - Muse Spark 1.3 (Meta Model API) writes one line from lesson state only. It has a strict JSON schema, a word limit, a blocklist, and bundled fallbacks.
  - Leda speaks the line sentence by sentence, in parallel.
  - Both possible replies are prefetched while the child has a go. Measured: LLM 1.0–1.5 s, TTS 3–4 s, so a reply is usually ready when the grown-up taps.
- **Puppet:**
  - `prototypes/mibo-puppet/mibo-puppet.js` is shared unchanged between the browser lab and the app, through a Canvas2D shim on React Native Skia (`app/src/puppet/canvas2d.ts`).
  - Metro watches that folder.
  - The one change to the module: `say` segments accept `visemes` (an audio-derived track) and `clock` (the player's position).
- **Lip sync, forced alignment:** `app/src/voice/aligner.ts`.
  - **Phonemes:** from CMUdict, with a small custom word list (e.g. "Mibo").
  - **Timing:** a 3-state-per-phoneme HMM over MFCC features with optional pauses between words; Viterbi finds each phoneme's timing.
  - **Training:** on Leda's own voice: 70 lines, about 5 minutes (`scripts/train-aligner.ts`).
  - **Shapes:** phonemes map to 20 mouth shapes. New this session: `n`, `ih`, `uh` and `w`, added to the puppet's `VISEMES`.
  - **Measured:** about 6 shape changes a second, with rest at 13% of the time.
  - **Fallbacks:** the older text-and-audio warp (`align.ts`) and the frame classes (`analyze.ts`). Quiet high-band frames count as a hiss, because /θ/ sits below the −28 dB floor.
- **Waits between lines fixed** (founder saw 5–10 s gaps on the phone):
  - every bundled clip is downloaded to the phone before the lesson starts (Expo Go otherwise streams each one from Metro)
  - dead air is trimmed from both ends of every clip
  - the end of a clip is detected from the play position as well as the finished event
- **Mibo reshaped to the founder's original art** (2026-10-28):
  - a squat round dome with two soft rolls down the left side
  - bigger eyes
  - thick flipper arms: stubby at rest, stretching to full length when they swing out (`ARMS.rest` / `ARMS.stub`)
  - drawn smaller in frame (`STYLE.frame`)
- **UI:** soft and colorful throughout.
  - Fredoka font, pastel palette, candy buttons.
  - Mibo's stage is a rounded card.
  - Captions sit in a speech bubble.
  - Progress dots take the color of their sound.
  - A sticker card at the end.
- **Bundled voice:**
  - 30 Leda clips in `app/assets/voice/`, made by `npm run clips`.
  - All model clips pass the ≥0.5 s hiss check.
- **Verified:**
  - In the desktop browser (web build): the puppet renders in the hand-drawn style, the lesson plays with audio and captions, and the tap → thinking → live reply loop works.
  - The API route was smoke-tested with curl, including rejecting targets that are not in the lesson.
  - **Not yet verified on a real iPhone in Expo Go.**

## Next

1. **Phone test.** Run the full lesson on the iPhone in Expo Go. Watch for:
   - frame rate: the whole puppet is redrawn on the JS thread up to 24 times a second
   - audio in silent mode
   - tunnel latency on the reply route
2. **Ear-check the TH clips.** Listen to `th_hold`, `word_thumb`, `word_three` and `word_think` (the check cannot tell /θ/ from /f/). Remake any that sound wrong with `npm run clips -- --only <id> --force`.
3. **Stickers and stars** (PROJECT #38): stars count now, but the sticker at the end is only spoken.
4. **Demo build without the laptop.**
   - Option 1: deploy the API route to EAS Hosting (`npx expo export -p web && eas deploy`, keys as EAS env vars, `origin` in the expo-router plugin).
   - Option 2: publish with `eas update`.
5. **Later:** an on-device recogniser in a dev build (docs/02 §4), behind the same turn shape. Reply words could then react to what was heard.

## Environment notes

- **Keys:**
  - The root `.env` holds `OPENROUTER_API_KEY` and `META_AI_API_KEY`. `app/.env` is a copy that Expo CLI loads; both are git-ignored.
  - Never put either key in an `EXPO_PUBLIC_` variable.
- **Cost so far:** about 40 Leda clips plus a dozen live turns, well under $0.50 of OpenRouter credit.
- **EAS:** logged in as `andrice94`. No EAS project is linked yet: `eas init` when a build or update is needed.
- **Web check:**
  - `public/canvaskit.wasm` is git-ignored. Run `npm run web:setup` to copy it.
  - `.claude/launch.json` has a `mibo-web` preview config.
