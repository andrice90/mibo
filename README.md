<p align="center">
  <img src="assets/mibo-wave.gif" alt="Mibo, a mint-colored friendly blob monster, waving" width="360">
</p>

<h1 align="center">mibo</h1>

<p align="center"><strong>Playful speech practice for families, guided by a character who shows kids how sounds are made.</strong></p>

mibo is an iOS app for families to use together. A friendly animated character, Mibo, leads short speech-practice lessons. Mibo models each sound with a big, easy-to-copy mouth, listens to the child's try on the phone, and answers with a live, encouraging line. A grown-up sits alongside, picks a lesson (or describes the words they want to practise and mibo makes a new one), and can step in at any moment with two arrow buttons.

It is built for the families in the gap: children who find some sounds hard, such as a lisp on `s` sounds, unclear words, or early sound-awareness skills that support reading, while they wait for, sit between, or cannot easily access professional support.

## What mibo is and is not

mibo is an **educational practice companion**. It does not diagnose, it does not treat, and it makes no guarantees about outcomes. It never labels a child. It gives families a kind, motivating way to practise a little every day, and it says plainly in the app: this is not a replacement for a speech-language pathologist.

## How it works

1. **A grown-up agrees once.** On first start, a grown-up confirms they will supervise, reads that mibo is not a therapist and that Mibo's replies are AI-generated, and chooses whether Mibo may listen.
2. **Pick a lesson.** The home screen lists the lessons, each with Continue or Start over from where it was left.
   - **Lesson 1:** the snake sound and the tongue sound (`s`, `th`)
   - **Lesson 2:** the quiet `sh` sound, at the start and end of words
   - **Lesson 3:** the buzzy bee `z` sound
   - **Rhyme time:** saying rhyming pairs, then "what rhymes with…?" picture games
   - **Twisty words:** long, wiggly words practised chunk by chunk ("Spa… ghe… tti! Spaghetti!")
3. **Say who's playing (optional).** The grown-up can type a first name, so Mibo greets and cheers the child by name.
4. **Practise with Mibo.** Each try goes: "Watch my mouth", Mibo models the sound, "Your turn", Mibo listens, then a reaction and a live reply. A tricky try is shown again, up to twice, and then Mibo moves on smiling. Picture games ask the child to tap one of two big cards. The grown-up's ◀ ▶ arrows are always on screen: while Mibo listens, ▶ means "they did it" and ◀ means "show it again".
5. **Finish with a sticker.** There are no wrong-answer buzzers, no red crosses, and no lost streaks, just stars and a sticker at the end.

### Make a new lesson

From the home screen a grown-up can type the kind of words to work on (say, "food words with s"). Meta AI writes a lesson plan: words, how Mibo models each one, and a picture game. The grown-up reviews it, and only after they accept it does Mibo's voice record the lines. The lesson is saved on the phone and appears on the home screen straight away, with no app update.

## How Mibo listens

Each lesson type uses the check that fits it:

- **Sound lessons (1–3):** an on-device acoustic check reads the opening or closing sound of each word and tells `s` from `th`, `sh`, `z` and a stopped `t`. It deliberately does not use speech-to-text, which would "correct" a lisp and hide it.
- **Twisty words:** an on-device word check compares the try against templates made from Mibo's own model clips, so a muddled try still counts as the right word but a different word does not.
- **Rhyme time:** any speech passes for saying a pair, since a sound check cannot hear a rhyme. Picture games are scored by the tap.
- **Made lessons:** speech-to-text checks the words, so any word, including long ones like *strawberry*, can be practised. This needs an EAS build; in Expo Go there is no recogniser, so any speech counts and the grown-up's arrows decide.

The checks are set loose and the grown-up's arrows always override them.

## Privacy by design

- **The sound lessons never send a child's voice anywhere.** Each try is recorded to a temporary file, checked on the phone, and deleted at once.
- **Made lessons use speech-to-text,** which runs on the device where iOS supports it. Only the recognised words are used; the app never keeps or sends the audio itself.
- **Live replies get lesson state only:** the target word, how the try sounded, and the attempt number. Never audio, and never the child's name. Mibo's line is spoken with text-to-speech, and nothing is stored on a server.
- **An optional first name**, typed by the grown-up, goes only to the voice service, once, to make four greeting and cheer lines. It is kept on the phone and can be removed.
- **Made-lesson requests** send the grown-up's description to Meta AI to write the plan, and the plan's lines to the voice service.
- Progress, names, consent and made lessons are all stored on the phone. No accounts, no ads, no selling data.

## Status

mibo is being built solo for the **Meta Global AI Developer Hackathon (Oct 26 – Nov 4, 2026)**, Indie Developer track, *Build for Your World* theme.

What's on `main` today:

- Five playable lessons (1–3, Rhyme time, Twisty words) plus grown-up-made lessons
- The hand-drawn puppet Mibo with lip sync to his own voice
- On-device listening for every built-in lesson, and speech-to-text for made lessons
- Live replies written by Muse Spark (Meta Model API) and spoken in Mibo's voice
- One-time grown-up consent, optional names, and saved progress with resume
- An EAS project with development, preview and production build profiles, for TestFlight builds with speech-to-text

Lesson 1 has had its first real family test on an iPhone and iPad.

## Tech at a glance

- **App:** Expo SDK 58 / React Native 0.88 (TypeScript, Expo Router). Runs in Expo Go; EAS builds add speech-to-text.
- **Mibo:** a code-drawn, hand-drawn-style puppet on React Native Skia, sharing one drawing file with the browser lab in `prototypes/mibo-puppet`.
- **Lip sync:** a small forced aligner (CMUdict phonemes, MFCC HMM trained on Mibo's voice), mapped to 20 mouth shapes.
- **Voice:** Gemini 3.8 Flash TTS (voice Leda) via OpenRouter, with pre-checked bundled clips for every built-in lesson.
- **Listening:** an on-device acoustic sound check, an on-device word check (DTW over MFCC), and `expo-speech-recognition` for made lessons.
- **AI:** Meta Model API (Muse Spark 1.3) writes Mibo's live replies and the made-lesson plans. Keys stay in Expo API routes and never reach the phone.
- **Storage:** on the device only.

See [`app/README.md`](app/README.md) to run it.

## Repository

- [`app/`](app/): the Expo app
- [`docs/`](docs/): research, design and decisions
- [`prototypes/`](prototypes/): the browser puppet lab, the TTS voice bake-off, and three alternative character concepts

Further reading:

- Decisions: [PROJECT.md](PROJECT.md)
- Session handoff: [HANDOFF.md](HANDOFF.md)
- Research & curriculum: [docs/01-research-and-curriculum.md](docs/01-research-and-curriculum.md)
- Tech stack & architecture: [docs/02-tech-stack-and-architecture.md](docs/02-tech-stack-and-architecture.md)
- Character, voice & animation: [docs/03-character-voice-and-animation.md](docs/03-character-voice-and-animation.md)
- Product & lesson design: [docs/04-product-and-lesson-design.md](docs/04-product-and-lesson-design.md)
- Phased plan (hackathon → v1): [docs/05-phased-plan.md](docs/05-phased-plan.md)
- Live voice pivot & TTS discovery: [docs/06-live-voice-and-tts.md](docs/06-live-voice-and-tts.md)
- Lessons 2–4: [docs/07-lessons-2-to-4.md](docs/07-lessons-2-to-4.md)
- Twisty words: [docs/08-twisty-words.md](docs/08-twisty-words.md)

Built by a solo developer: Andrew Rice. US English first.
