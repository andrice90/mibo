# 07 — Lessons 2–4: the quiet sound, the buzzy sound, rhyme time

Status: Draft, written 2026-10-28 to fill the home screen's "Soon" lessons. Built on the Lesson 1 pipeline (bundled Leda clips, on-device hiss check, live replies, the grown-up's ◀ ▶ arrows). Educational practice only (PROJECT #1): no outcome claims in any line.

All three follow the ladder in `docs/01` §2 (hear it, say it alone, say it in words, use it in play) and the session shape in `docs/04` §3 (warm-up, sound focus, word practice, mini-game, celebration). Each runs about 4–6 minutes. Lesson 2 and 3 add two things Lesson 1 does not have:

- **Final-position words** (rung 4, `docs/01` §2: "initial, then final"). The check looks for the hiss after the word's last vowel instead of before its first one (`judge.ts`, kind `end`).
- **A listening game** (`pick` step): Mibo says two words and the child taps the picture with the target sound. It is the "first-sound hunt" from `docs/01` §3, and it interleaves hearing with saying (Gillon, `docs/01` §1). Tapping needs no listening, so it works in a noisy room too.

Rhyme time is the first phonological-awareness lesson. It uses the same two step kinds: "say the pair" tries (the check only listens for speech, since it cannot hear a rhyme) and "which one rhymes?" picks.

## Shared rules (unchanged from Lesson 1)

- Teaching sounds are bundled, checked clips, never live (PROJECT #45). Talk lines never contain a stretched sound.
- Up to 2 re-models per word, then Mibo moves on smiling (`MAX_ATTEMPTS`). A pick gets one "let's listen again", then Mibo shows the answer and moves on. No star is lost, nothing says "wrong".
- The grown-up's arrows: while Mibo waits, ▶ = "they did it" (star) and ◀ = "show it again". At any other moment they step through the lesson.
- Live replies after each try know the sound, the word and what the check heard. Rhyme pairs get only "got" replies (the check cannot tell a missed rhyme).

## Lesson 2: the quiet sound /ʃ/ ("sh") — id `sh`

**Goal:** /ʃ/ alone, at the start of words, and at the end of words; hear /ʃ/ against /s/.
**Mouth cue:** lips pushed out round like a kiss, teeth close, blow. Nickname: "the quiet sound" (the baby-is-sleeping sound).
**Why these words:** high picture value, one syllable, /ʃ/ followed by different vowels (oo, i, ee, e). Final words avoid /s/ and /θ/ elsewhere in the word. The pick pairs contrast /ʃ/ with Lesson 1's /s/ words (sock, sun), so the two sounds are heard side by side.

| # | Step | Mibo says (or does) | Check |
|---|---|---|---|
| 1 | Hello | "Hi friend! Today we're learning the quiet sound. It's the sound we make when a baby is sleeping!" | — |
| 2 | Warm-up | "First, let's wake up our mouths! Make a big kiss face... now a big smile! Kiss... smile!" | — |
| 3 | Sound intro | "Here's the quiet sound. Push your lips out like a kiss, keep your teeth close, and blow." | — |
| 4 | Say it alone 🤫 | model `sh_hold` ("Shhhhhh", trimmed), then "Now you! Lips out, and make a long quiet sound." | hold: sh |
| 5 | Into words | "Let's put the quiet sound in some words." | — |
| 6–9 | Start of words | shoe 👟, ship 🚢, sheep 🐑, shell 🐚 ("Shhhhh... shoe!") | word: sh |
| 10 | Game intro | "Now a listening game! I'll say two words. Tap the one with the quiet sound." | — |
| 11 | Pick | "Sock... or shoe? Which one has the quiet sound?" 🧦 / 👟 → "Shoe! It starts with the quiet sound." | tap |
| 12 | Pick | "Ship... or sun? Which one has the quiet sound?" 🚢 / ☀️ → "Ship! It starts with the quiet sound." | tap |
| 13 | End of words | "The quiet sound can hide at the end of words too. Listen!" | — |
| 14–15 | End of words | fish 🐟, brush 🪥 ("Fi... shhhhh. Fish!") | end: sh |
| 16 | Celebration | "You did it! You made the quiet sound at the start and the end of words. Here's a sticker for you!" | — |

## Lesson 3: the buzzy sound /z/ — id `z`

**Goal:** /z/ alone, at the start and end of words; hear /z/ against /s/ and other sounds.
**Mouth cue:** the snake-sound mouth (teeth together, smile) with the voice switched on. The warm-up has the child feel the buzz with a hand on their neck, which is the usual cue for voicing. Nickname: "the buzzy bee sound".
**Why these words:** zoo, zebra, zero, zip are the most picturable /z/-initial words. Final /z/ (bees, cheese) is the common place for it in English. "Sip or zip" is a true minimal pair for the s/z contrast.
**What the check accepts:** placement, not voicing. A /z/ said without the buzz sounds like /s/ and still passes: the tongue and teeth were right, and children (and adults, at the end of words) often unvoice /z/. A tongue-out /ð/ is what the check catches, as it catches /θ/ in Lesson 1.

| # | Step | Mibo says (or does) | Check |
|---|---|---|---|
| 1 | Hello | "Hi friend! Today we're learning the buzzy bee sound!" | — |
| 2 | Warm-up | "First, let's wake up our voices! Put your hand on your neck and hum. Can you feel it tickle?" | — |
| 3 | Sound intro | "Here's the buzzy sound. It's like the snake sound, but your voice turns on. Teeth together, smile, and buzz!" | — |
| 4 | Say it alone 🐝 | model `z_hold` ("Zzzzzz", trimmed), then "Now you! Make a long buzzy bee sound." | hold: z |
| 5 | Into words | "Let's buzz in some words." | — |
| 6–9 | Start of words | zoo 🦒, zebra 🦓, zero 0️⃣, zip 🤐 ("Zzzzz... zoo!") | word: z |
| 10 | Game intro | "Now a listening game! I'll say two words. Tap the one with the buzzy sound." | — |
| 11 | Pick | "Zebra... or fish? Which one has the buzzy sound?" 🦓 / 🐟 → "Zebra! It starts with the buzzy sound." | tap |
| 12 | Pick | "Sip... or zip? Which one has the buzzy sound?" 🥤 / 🤐 → "Zip! Your voice buzzes in zip." | tap |
| 13 | End of words | "The buzzy sound can hide at the end of words too. Listen!" | — |
| 14–15 | End of words | bees 🐝, cheese 🧀 ("Bee... zzzzz. Bees!") | end: z |
| 16 | Celebration | "You did it! You buzzed like a busy bee. Here's a sticker for you!" | — |

## Lesson 4: Rhyme time — id `rhyme`

**Goal:** hear and say rhyming pairs, then pick the rhyme from two pictures (rhyme recognition, `docs/01` §1, §3).
**Why these words:** CVC words with clear pictures. The picks reuse Lesson 1–3 words (sock, mouse, snake, star) so the same sounds come back in play. Distractors share nothing with the target's ending, and none of them rhyme with each other by accident.
**Check:** "say the pair" passes on any speech (the grown-up's ◀ is there if they want it again). Picks are taps.

| # | Step | Mibo says (or does) | Check |
|---|---|---|---|
| 1 | Hello | "Hi friend! It's rhyme time! Rhyming words sound the same at the end." | — |
| 2 | Say the pair 🐱🎩 | "Listen!", model "Cat... hat!", then "Now you say them both!" | speech |
| 3 | Say the pair 🐝🌳 | "Bee... tree!" | speech |
| 4 | Say the pair 🐸🪵 | "Frog... log!" | speech |
| 5 | Game intro | "Now a rhyme game! I'll say a word. Tap the picture that rhymes." | — |
| 6 | Pick (🧦) | "What rhymes with sock? Clock... or fish?" 🕐 / 🐟 → "Sock, clock! They rhyme!" | tap |
| 7 | Pick (🐭) | "What rhymes with mouse? Moon... or house?" 🌙 / 🏠 → "Mouse, house! They rhyme!" | tap |
| 8 | Pick (🎂) | "What rhymes with cake? Snake... or ball?" 🐍 / ⚽ → "Cake, snake! They rhyme!" | tap |
| 9 | Pick (⭐) | "What rhymes with star? Sock... or car?" 🧦 / 🚗 → "Star, car! They rhyme!" | tap |
| 10 | Celebration | "You did it! You're a rhyme time star. Here's a sticker for you!" | — |

## Build notes

- Content: `app/src/lesson/content.ts` (`LINES`, `MODELS`, the step lists and `PLANS`). Home screen: `app/src/lesson/lessons.ts`.
- New step kind `pick` (two picture choices, `lesson.tsx` draws them). New exercise fields: `kind` (`hold`, `word`, `end`) and `cue` (the line before the model; "Listen!" for rhyme pairs).
- Each lesson preloads only its own clips plus the shared ones.
- Check (`judge.ts`): new targets `sh` and `z`, new kind `end`. For `z`, voiced hiss frames count, and a voiced hiss is reported as `z`. Calibrate with `npx tsx scripts/judge-test.ts --gen` (the set now has sh and z words).
  - Two fixes came out of calibration. A vowel must now last 50 ms: /z/ often starts with a 20–30 ms voiced blip, which had been taken for the vowel, so the hiss after it was ignored ("zoo" read as a stop). A quiet hiss that peaks below 6 kHz is now /ʃ/, not /θ/ (a soft "shell").
  - Result on the synthetic set (Leda and Puck, 2026-10-28): 71/76. The Lesson 1 words score 33/36, the same as before. The new sh and z words score 38/40. The two misses are the made-up "thoo" for "zoo": Leda reads it as /s/, and Puck's comes out as a stop. Neither passes, so the child still gets another go. Every z came out unvoiced in TTS, so the voiced-z path has not been tested on real audio yet.
- Bundled voice: 55 new Leda clips (`npm run clips`). All 14 new model clips passed the hiss check on the first run (0.5–0.88 s holds), but none has been heard yet.
- Live replies (`server/reply.ts`): sound names and mouth tips for sh, z and rhyme.

## Test checklist (phone, with a grown-up)

1. Each lesson opens from home, runs end to end, and shows the sticker card. Continue / Start over works mid-lesson.
2. Ear check the model clips: `sh_hold`, `z_hold` and every `word_*` for sh and z. `z_hold` must buzz, not say "zee". Final-word clips should split the word ("Fi... shhhhh. Fish!").
3. Hold and start-of-word tries: a good sh / z gets praise; an /s/ for sh, or a tongue-out /ð/ for z, gets a gentle reply that names it. Watch the `[hear]` lines.
4. End-of-word tries (fish, brush, bees, cheese): the check reads the end of the word. Note any false "tricky" in the `[hear]` log.
5. Picks: tapping the right picture gives a star and the answer line; a wrong tap gets "let's listen again" and the question once more; a second wrong tap shows the answer and moves on. ▶ while waiting counts as right; ◀ asks again.
6. Rhyme pairs: any spoken try is praised; silence gets the "your turn" nudge, then waits for the arrows.
7. iPhone SE: the two picture cards fit without covering Mibo's mouth.
