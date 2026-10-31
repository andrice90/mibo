# 08 — Twisty words: long, hard-to-say words chunk by chunk

Status: Built 2026-10-30. A dyslexia-friendly pronunciation lesson in the
Lesson 1 pipeline (bundled Leda clips, on-device listening, live replies,
the grown-up's ◀ ▶ arrows). Educational practice only (PROJECT #1): no
diagnosis, no disorder label, and no outcome claim reaches the child.

## Why this shape

Children who find print and speech tricky often meet the same wall in both:
a long word arrives all at once and falls apart. The fix this lesson
practises is the one used for both reading and saying long words — break it
into little chunks, say (or read) each chunk, then put them together. It is
phonological-awareness and articulation practice at once (PROJECT #2's
overlap), kept light: the words are twisty for everybody, and that is the
game. Mibo never says a word is hard *for you*, and never names a condition.

**The train game:** each chunk is a carriage. Mibo says the word slowly,
chunk by chunk ("Spa... ghe... tti!"), then the whole word ("Spaghetti!").
The child copies. Six words, rising in length, ending with the grand finale.

## Words

Chosen for high picture value, clear chunk boundaries, and being famous
for tripping children up (several are words children classically say
backwards or mushed: "pasghetti", "aminal"-style slips):

| Word | Chunks in the model clip | Why |
|---|---|---|
| spaghetti 🍝 | Spa... ghe... tti! | The classic muddled word; 3 chunks |
| elephant 🐘 | El... e... phant! | Loved animal, soft middle chunk |
| dinosaur 🦕 | Di... no... saur! | High excitement, 3 clear chunks |
| butterfly 🦋 | But... ter... fly! | Two known mini-words inside one long one |
| umbrella ☂️ | Um... brel... la! | Everyday word, tricky middle cluster |
| hippopotamus 🦛 | Hip... po... pot... a... mus! | 5 chunks; the grand finale |

## Steps (15, about 4–6 minutes) — id `twisty`

| # | Step | Mibo says (or does) | Check |
|---|---|---|---|
| 1 | Hello | "Hi friend! Today we're playing Twisty Words! Some words are long and wiggly, and we take them one little chunk at a time." | — |
| 2 | Warm-up | "Stick your tongue out... wiggle it... now make the silliest face you can!" | — |
| 3 | How it works | "I say a word slowly, chunk by chunk, like a little train. Then we put the chunks together and say the whole word!" | — |
| 4 | Into words | "Let's load the word train!" | — |
| 5–8 | Say it | spaghetti 🍝, elephant 🐘, dinosaur 🦕, butterfly 🦋 | speech |
| 9 | Game intro | "Now a listening game! I'll say a twisty word. Tap its picture!" | — |
| 10 | Pick | "Which one is spaghetti? Elephant... or spaghetti?" 🐘 / 🍝 | tap |
| 11 | Pick | "Which one is butterfly? Butterfly... or umbrella?" 🦋 / ☂️ | tap |
| 12 | Say it | umbrella ☂️ | speech |
| 13 | Finale intro | "Now the longest, wiggliest word of all. Ready?" | — |
| 14 | Say it | hippopotamus 🦛 | speech |
| 15 | Celebration | "You did it! You said the long, twisty words chunk by chunk. Here's a sticker for you!" | — |

## Check

The hiss check (`judge.ts`) cannot score a whole multi-chunk word, so
twisty tries have their own on-device check (`src/voice/wordcheck.ts`):
the try's MFCC frames are warped (DTW) against templates of all six
words, made from the whole word at the end of each bundled model clip
(`scripts/make-word-templates.ts` → `src/lesson/word-templates.json`).
A try passes when the target word is the closest template, within the
calibrated distance bars — so a muddled try at the right word passes,
but a different word does not: it gets the gentle
"tricky" reply and a re-model (up to 2, then Mibo moves on smiling; no
fail state ever shows). The grown-up's arrows still override.

Calibration (`scripts/wordcheck-test.ts`, Leda + Puck saying right,
muddled and wrong words, 48 tries): right 11/12, muddled 9/12, wrong
rejected 23/24. Known misses: "pasghetti" lands closest to *umbrella*
in both voices, and one synthetic "banana" passed as *umbrella* —
adult/TTS voices, not children; real-child recordings should extend
the set before the bars are tightened.

## Build notes

- Content: `app/src/lesson/content.ts` (`tw_*` lines, six `word_*` models
  in `MODELS`, `TWISTY_WORDS`, `PLANS.twisty`). Home screen: `twisty` in
  `app/src/lesson/lessons.ts`. Colour: `SOUND.twisty` (sky) in
  `app/src/ui/theme.ts`. Live replies: `twisty` in `SOUNDS`, `SOUND_NAME`
  and `SOUND_TIP` in `app/src/server/reply.ts`; any-speech verdict in
  `app/src/lesson/useLesson.ts`.
- Bundled voice: 10 talk lines + 6 chunked model clips, Leda via
  `scripts/make-clips.ts` (Gemini 3.8 Flash TTS through OpenRouter,
  PROJECT #37). Model clips use delivery notes (chunks slowly, then the
  whole word once, proud) and are not hiss-gated.

## Test checklist (phone, with a grown-up)

1. "Twisty words" 🌀 opens from home, runs end to end, sticker card shows.
2. Ear-check every `word_*` twisty clip: chunks are separate and slow,
   then the whole word once, correct (spa-GET-ee, hip-po-POT-a-mus).
3. Say each word (muddled counts!): praise + star. Silence nudges once,
   then waits for the arrows. ◀ re-models, ▶ moves on with a star.
4. Picks: right tap stars; wrong tap listens again; second wrong tap
   shows the answer smiling.
5. iPhone SE: the word badge (hippopotamus is long) fits without covering
   Mibo's mouth.
