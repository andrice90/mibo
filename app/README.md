# Mibo app (Expo Go)

Lesson 1, the snake sound /s/ and the tongue sound /θ/, with the hand-drawn puppet Mibo speaking in Leda's voice. Runs in **Expo Go** on iPhone and iPad (SDK 58), no native build.

## Run it on your phone

1. Put the keys in `app/.env` (git-ignored; copy the repo-root `.env`):
   - `OPENROUTER_API_KEY`: Leda's voice (Gemini 3.8 Flash TTS).
   - `META_AI_API_KEY`: Mibo's live replies (Muse Spark 1.3, Meta Model API).
2. `npm install`, then `npm run tunnel` (or `npm start` if the phone is on the same Wi-Fi).
3. Scan the QR code with the iPhone camera. It opens in Expo Go.

The API route runs inside the dev server on your computer, so the keys stay there and never reach the phone.

To check it on a desktop browser: `npm run web:setup` once (copies CanvasKit), then `npm run web`.

## How it fits together

- `src/app/index.tsx`: home, the lesson list (`src/lesson/lessons.ts`), with Continue / Start over from saved progress (`src/lesson/progress.ts`).
- `src/app/welcome.tsx`: before each lesson. It has:
  - the optional name step, with saved names as chips (`src/lesson/name.ts`, `/api/name`)
  - Mibo's intro
  - the grown-up checklist (supervision, not a therapist, AI replies, listening on the phone)
- `src/app/lesson.tsx`: Mibo, captions, and the grown-up's ◀ ▶ arrows, always on screen.
- `src/voice/listen.ts` + `src/voice/judge.ts`: after "your turn", Mibo listens on the phone (audio kept in memory only, then dropped) and checks the hiss: s, th, sh or a stopped t. No speech-to-text, which would hide a lisp. Calibrate with `npx tsx scripts/judge-test.ts --gen`.
- `src/lesson/content.ts`: the lesson steps and every line Mibo says.
- `src/lesson/useLesson.ts`: runs the lesson and saves its place. While the child has a go, it already asks for both possible replies, so the right one is ready when the try ends.
- `src/app/api/reply+api.ts`: the live turn. It sends lesson state only (target word, how the try sounded, attempt number, never audio or names) to Muse Spark, which writes one checked line. Leda speaks it sentence by sentence. Anything slow or rejected falls back to a bundled line.
- `src/puppet/`: draws `prototypes/mibo-puppet/mibo-puppet.js` (the same file as the browser lab) through a small Canvas2D-on-Skia shim, with the lab's three clocks: body 6 fps, mouth 24 fps, line boil 3 fps.
- `src/voice/aligner.ts`: lip sync. Gemini TTS returns no timings, so a small forced aligner finds them.
  - Phonemes come from the CMU dictionary (`src/voice/g2p.ts`).
  - They are placed on the audio with an HMM over MFCC features (`src/voice/features.ts`), trained on Leda's own voice.
  - Each phoneme becomes one of 20 mouth shapes.
  - It runs on the server for live lines and in the clip script for bundled ones. The model is `src/voice/phone-model.json`.
  - `src/voice/analyze.ts` keeps the frame classes used for the hiss check and as a fallback.
- `src/ui/`: the friendly look: Fredoka font, pastel palette, candy buttons, cards.

## Lip-sync aligner

`npx tsx scripts/train-aligner.ts --gen` makes any missing training audio, about 40 varied sentences in Leda's voice (~$0.05, kept in the git-ignored `train-audio/`). It then retrains on those plus every lesson clip. After retraining, run `npx tsx scripts/make-clips.ts --reanalyze` to rebuild the bundled mouth tracks.

## Bundled voice

`npm run clips` makes every missing clip in `src/lesson/content.ts` with Leda and writes `assets/voice/`. Model clips get several takes and must hold a hiss for at least 0.5 s. The check cannot tell /θ/ from /f/, so listen to the TH clips yourself. Other modes:

- `--only id,id --force` remakes the named clips.
- `--reanalyze` rebuilds the mouth tracks from the WAVs on disk, with no API calls.
