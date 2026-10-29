<p align="center">
  <img src="assets/mibo-wave.gif" alt="Mibo, a mint-colored friendly blob monster, waving" width="360">
</p>

<h1 align="center">mibo</h1>

<p align="center"><strong>Playful speech practice for families, guided by a character who shows kids how sounds are made.</strong></p>

mibo is an iOS app for families to use together. A friendly animated character, Mibo, leads short daily speech-practice lessons: a parent picks today's exercises, Mibo models each sound with an exaggerated, easy-to-copy mouth, the child practises words and sound games, and the parent sees clear progress plus one simple idea for practising at home.

It is built for the families in the gap: children who find some sounds hard, such as a lisp on `s` sounds, unclear words, or early sound-awareness skills that support reading, while they wait for, sit between, or cannot easily access professional support.

## What mibo is and is not

mibo is an **educational practice companion**. It does not diagnose, it does not treat, and it makes no guarantees about outcomes. It never labels a child. It gives families a kind, motivating way to practise a little every day, and it says plainly in the app: this is not a replacement for a speech-language pathologist.

## How it works

1. **Say hello (parent + child, ~5 minutes).** A parent answers a few questions, then the child plays a short "sound adventure" so mibo can hear which sounds to start with. The result is a practice level, not a diagnosis.
2. **Pick today's practice (parent, ~30 seconds).** Short on time? Warm-up + one sound game. Good day? The full set. Lessons are short: 8–12 minutes is the longest, and most days are less.
3. **Practise with Mibo (child + parent).** Mouth warm-ups, a sound focus, word practice, and a sound game. Mibo always encourages and shows the sound again. There are no wrong-answer buzzers, no red crosses, and no lost streaks, just stars and a sticker book that grows.
4. **See progress (parent).** Which sounds are mastered, which are still tricky, and one short "try this at bath time" idea for today.

## Privacy by design

- **A child's voice never leaves the phone.** All listening and scoring happens on the device; each try is checked there and deleted at once.
- Mibo replies live: lesson state only (the target word, how the try sounded, the attempt number; never audio) goes to an AI model that writes Mibo's next line, spoken with text-to-speech. Nothing is stored on a server.
- An optional first name, typed by the grown-up, goes only to the voice service to make four greeting lines, and is otherwise kept on the phone.
- An adult supervises every session. mibo says so before each one, and says that Mibo's replies are AI-generated.
- No ads. No selling data. Purchases, settings, and consent live behind a parental gate.

## Status

mibo is being built solo for the **Meta Global AI Developer Hackathon (Oct 26 – Nov 4, 2026)**, Indie Developer track, *Build for Your World* theme. The hackathon deliverable is one polished vertical slice: the `/s/` sound, end to end: assessment, lesson, on-device scoring, and a parent plan generated via the Meta Model API through a stateless proxy. Everything else is a staged roadmap, not a promise for Nov 4.

**Now (2026-10-28):** Lesson 1 (the S and TH sounds) runs end to end on iPhone and iPad in Expo Go, and has had its first real family test. It includes:
- the hand-drawn puppet Mibo with lip sync to his own voice
- listening on the device, with a sound check that tells S from TH, SH and T
- live, encouraging replies written by Muse Spark (Meta Model API) and spoken by Gemini TTS
- a lesson list with resume, optional name personalisation, and the grown-up's ◀ ▶ arrows as a fallback

See [`app/README.md`](app/README.md) to run it and [HANDOFF.md](HANDOFF.md) for the current state.

- Decisions: [PROJECT.md](PROJECT.md)
- Research & curriculum: [docs/01-research-and-curriculum.md](docs/01-research-and-curriculum.md)
- Tech stack & architecture: [docs/02-tech-stack-and-architecture.md](docs/02-tech-stack-and-architecture.md)
- Character, voice & animation: [docs/03-character-voice-and-animation.md](docs/03-character-voice-and-animation.md)
- Product & lesson design: [docs/04-product-and-lesson-design.md](docs/04-product-and-lesson-design.md)
- Phased plan (hackathon → v1): [docs/05-phased-plan.md](docs/05-phased-plan.md)
- Live voice pivot & TTS discovery: [docs/06-live-voice-and-tts.md](docs/06-live-voice-and-tts.md)

## Tech at a glance

- **App:** Expo SDK 58 / React Native (TypeScript), run in Expo Go today. An EAS TestFlight build comes later, for on-device speech-to-text.
- **Mibo:** a code-drawn hand-drawn puppet on React Native Skia, shared with the browser lab.
- **Lip sync:** a small forced aligner (CMUdict phonemes, MFCC HMM trained on Mibo's voice).
- **Voice:** Gemini 3.8 Flash TTS (voice Leda) via OpenRouter, with pre-checked bundled clips for the teaching sounds.
- **Listening:** an on-device acoustic sound check; no audio leaves the device.
- **Live replies:** Meta Model API (Muse Spark 1.3), with keys held in Expo API routes.
- **Storage:** on the device only.

Built by a solo developer with Muse (Wonder + Spark). US English first.
