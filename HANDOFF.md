# Handoff: Mibo app, Lesson 1 in Expo Go

Updated 2026-10-28, end of the day-one app session. Read this first, then `PROJECT.md` #45–#49, then `app/README.md`.

## Where the work is

- **Branch:** `main`, pushed to `github.com/andrice90/mibo`.
- **Hackathon deadline:** Wed Nov 4, 9:00 PM ET (PROJECT #29).
- **App:** `app/`, an Expo SDK 58 app run in **Expo Go**. Speech-to-text comes later, in a TestFlight build (see Next).
- **To run it:** in `app/`, run `npx expo start` (LAN), or `npm run tunnel`. Scan the QR code with the iPhone or iPad camera.
- **First real test (2026-10-28):** the founder and their 3-year-old ran a full lesson end to end. The child loved it.

## What the app does now

- **Home (`src/app/index.tsx`):** the lesson list from `src/lesson/lessons.ts`. Lesson 1 is playable; Lessons 2–3 and Rhyme time show "Soon".
  - A lesson with saved progress offers Continue or Start over.
- **Before a lesson (`src/app/welcome.tsx`):**
  - **Name step (silent):** saved names appear as chips ("Who's playing?"); a new name can be typed, or the step skipped.
  - **Mibo's intro:** "Hi {name}! I'm Mibo…" plus the grab-a-grown-up line, or the original intro without a name.
  - **Grown-up checklist:** supervision, not a therapist, AI replies, listening on the phone only, and the "Let Mibo listen" option. It fits an iPhone SE without scrolling.
- **Lesson 1 (`src/lesson/content.ts`):**
  - hello, a mouth warm-up
  - the snake sound, then sun, sock, soap, seal
  - the tongue sound, then thumb, three, think
  - "Great job, {name}!" and a sticker card
- **Each try:**
  1. "Watch my mouth", then the model clip, zoomed on the mouth.
  2. "Your turn": the mic starts recording during this line.
  3. Listening, with the level meter.
  4. A reaction ("Yay!", "Ooh!", "Wow!", "Woo-hoo!", or the name line).
  5. A live reply.
  6. A tricky try is shown again, up to 2 re-models, then Mibo moves on smiling.
- **The grown-up's ◀ ▶ arrows** are always on screen:
  - While Mibo listens, ▶ means "they did it" and ◀ means "show it again".
  - At any other moment they skip or step back. 🏠 returns home, keeping the lesson's place.
- **Listening (PROJECT #48):**
  - **Recorder (`src/voice/listen.ts`):** uses expo-audio's recorder. Each try goes to a temporary WAV, is read back, then deleted.
  - **Window:** only what comes after Mibo's line counts (`arm()`). It ends on a 1.2 s pause or after 8 s.
  - **Check (`src/voice/judge.ts`, `judgeTry`):** cuts the window into words and classifies each word's opening sound as s, th, sh or stop. It's a pass if any word has the target sound.
  - **Logs:** each try writes one `[hear] …` line to the dev-server terminal (numbers only), for tuning.
- **Live replies (PROJECT #45):**
  - **Writer (`src/server/reply.ts`):** Muse Spark 1.3 on the Meta Model API, from lesson state only. It gets the target, the result, what was heard, the attempt number, a random angle, and Mibo's last 4 lines to avoid repeating them.
  - **Voice:** Leda (Gemini 3.8 Flash TTS via OpenRouter) speaks the line sentence by sentence.
  - **Prefetch:** both likely replies are fetched while the child has a go.
  - **Guards:** strict JSON, a word limit and blocklist, bundled fallbacks, and a spend guard on `/api/reply`.
- **Names (PROJECT #49):** an optional first name goes only to the voice service, never to the reply LLM.
  - `/api/name` makes four lines.
  - Names and their clips are kept on the phone (`src/lesson/name.ts`) and can be forgotten with ×.
- **Progress:** `src/lesson/progress.ts` keeps step, stars and the name on the phone, and clears them when the lesson is finished.
- **Mibo (PROJECT #46):** drawn from `prototypes/mibo-puppet/mibo-puppet.js`, the same file as the browser lab, through a Canvas2D shim on Skia (`src/puppet/`).
  - Reshaped to the founder's art: a round dome, soft rolls and big eyes.
  - Stubby flipper arms that stretch when reaching.
  - Clocks: body 6 fps, mouth 24 fps, line boil 3 fps.
- **Lip sync (`src/voice/aligner.ts`):**
  - **Phonemes:** from CMUdict.
  - **Timing:** an MFCC HMM forced aligner trained on Leda's voice (`scripts/train-aligner.ts`).
  - **Output:** 20 mouth shapes, about 6 changes a second. Runs for bundled clips and live lines.
- **Voice clips:** 37 bundled Leda clips (`npm run clips`).
  - Reactions and "your turn" rotate (`VARIANTS`). "Watch my mouth" is the founder's take B.
  - All clips are preloaded to the phone before a lesson and trimmed of dead air.
- **UI:** Fredoka font, pastel palette, candy and squircle buttons with chalk arrows.
  - On iPad, every screen sits in a centered column.

## Bugs found and fixed today (worth knowing)

- **Mibo went silent after listening.** expo-audio's live `AudioStream` switches iOS to record-only on every start and never restores it. Fixed by moving to the recorder, which stays in play-and-record.
- **The first try was not heard.** Same root cause, plus a cold stream delivering silence. Also fixed by the recorder.
- **5–10 s gaps between lines.** In Expo Go each clip streamed from Metro on first play. Fixed by preloading clips to the phone and trimming dead air.
- **Live lines silent.** The reply audio was written with an async `write()` that was never awaited. Fixed with `writeSync`.
- **A quarter of live replies fell back to bundled lines.** Muse Spark's reasoning used up the 400-token limit. Fixed by raising `max_tokens` to 1200.
- **Mouth flickered between 2–3 shapes.** Replaced audio-only lip sync with the forced aligner.

## Open issues

- **iPad showed blank Skia** (Mibo and the chalk arrows) once, after the dev server had briefly failed to build. Probably fixed by a full reload; not confirmed.
- **Listening on the phone** has had only one logged pass (TH, "think"). The founder's "seal seal" with mixed words still needs a re-test on the new recorder.
- **The checker's thresholds** come from synthetic TTS calibration (33/36). They need real adult and child tries.
  - Today's privacy rule means tries are never saved, so calibration means reading the `[hear]` logs or a deliberate, consented recording session.
- **TH model clips** pass the hiss check, but the check cannot tell /θ/ from /f/. Needs an ear check: `th_hold`, `word_thumb`, `word_three`, `word_think`.
- **Spend guard** is in-memory. A public deploy needs an app token on the API routes.
- **Still open from PROJECT:** Gemini TTS licence terms for the app and demo, Meta Model API retention terms, and checking OpenRouter's retention setting for the name lines.

## Next

1. **Phone and iPad re-test:** listening with mixed words, the first try, and Skia on iPad after a full reload.
2. **Hackathon slice (PROJECT #31) still missing:**
   - the short parent questionnaire
   - the Meta-generated practice plan and parent tip (`docs/02` §5)
   - a simple parent dashboard
   - the 3-minute demo video
3. **Sticker book** (PROJECT #38): stars count, and the end card shows a sticker, but nothing collects them yet.
4. **Demo without the laptop:**
   - EAS Hosting for the API routes (`npx expo export -p web && eas deploy`, keys as EAS env vars, `origin` in the expo-router plugin).
   - Then `eas update`, or a TestFlight build.
5. **Speech-to-text (founder's plan, 2026-10-28):** after the Expo Go phase, move to an EAS build on TestFlight with `expo-speech-recognition`. Settings:
   - `requiresOnDeviceRecognition: true`, so audio stays on the device (#10)
   - `contextualStrings` set to the target word
   - `setCategoryIOS` playAndRecord with `defaultToSpeaker`, so Mibo keeps talking

   Speech-to-text finds the word and its timing; `judgeTry()` grades the hiss in that word. Cloud speech-to-text is ruled out (#10, COPPA voice rules).
6. **More lessons:** "sh", "z", rhyme time. They're content in `content.ts` plus a clips run.

## Environment notes

- **Keys:**
  - The root `.env` holds `OPENROUTER_API_KEY` and `META_AI_API_KEY`. `app/.env` is a copy that Expo CLI loads; both are git-ignored.
  - Never put either key in an `EXPO_PUBLIC_` variable.
- **Dev server:**
  - Expo forwards the phone's console to the terminal: `[hear]`, `[reply]`, `[audio]` lines.
  - After renaming routes or reinstalling packages, restart with `npx expo start --clear`; the server bundle goes stale.
- **Hot reloads** restart the lesson at its current step. Real users never get them.
- **Audio scripts** (all in `app/`):
  - `npm run clips`: make bundled lines (`--only id --force`, `--reanalyze`).
  - `npx tsx scripts/train-aligner.ts`: retrain the lip-sync aligner.
  - `npx tsx scripts/judge-test.ts`: score the checker.
  - Training and calibration audio live in the git-ignored `app/train-audio/`.
- **Cost so far:** well under $1 of OpenRouter credit (TTS, aligner corpus, live turns), plus Meta Model API calls.
- **EAS:** logged in as `andrice94`. No EAS project is linked yet: run `eas init` when a build is needed.
- **Web check:** `npm run web:setup` once (CanvasKit), then `npm run web`. `.claude/launch.json` has a `mibo-web` preview config.
