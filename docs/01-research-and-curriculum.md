# 01 — Research & curriculum

Status: Draft research base for v1. Solo-researched (PROJECT #15). Citations are starting points for the exercise library, not efficacy claims. No statement in this doc may be copied into the app as a promise of outcomes.

## 1. What the evidence supports (and what it does not)

mibo teaches two things in v1 (PROJECT #2, #20):

- **Articulation practice** for sibilants `/s, z, sh, ch/` — producing a target sound in isolation, then in syllables, words (initial/medial/final position), phrases, and short sentences.
- **Phonological awareness (PA)** — rhyme recognition/production, first-sound identification, syllable clapping/segmentation. PA is the bridge to early reading/dyslexia-risk support.

Research starting points to read in full before finalising the library:

- Gillon's integrated phonological awareness approach: children with speech sound disorders who received PA-integrated therapy made gains in speech production *and* transferred to phoneme awareness / early decoding tasks. Key implication for mibo: do not run articulation drills and PA games as separate worlds — interleave them on the same target sound (e.g. `/s/` words drive the rhyme/first-sound games that day).
- Comparative outcome work on PA training vs phonological therapy in children with specific language impairment + speech sound disorders found PA training at least as effective on speech measures and stronger on PA measures. Implication: PA games are core curriculum, not filler between drills.
- Systematic reviews/meta-analyses of phonological processing interventions in developmental speech/language disorders report positive effects on phonological awareness and phonological short-term memory. Implication: dosage matters — short, frequent sessions are the standard intervention shape; this supports PROJECT #5 (short daily practice) as design, not as a mibo efficacy claim.
- Classic early PA intervention studies (e.g. Hesketh et al. comparing combined PA + speech training vs speech training alone in preschoolers) are the methodological template for outcome measures if a future efficacy study (post-v1) is ever run.

**Limits, stated plainly:**

- Most evidence is for therapist-delivered intervention. App-delivered, parent-mediated practice at home is a delivery hypothesis, not a proven equivalent. The app must not import therapist-study outcomes as its own.
- Solo research risks selection bias and misreading. Mitigation: cite sources in-app at the library level ("activities informed by published phonological-awareness research"), invite SLP review as the first post-v1 upgrade (PROJECT #15), and keep every exercise reversible/removable if reviewed later.

## 2. How sounds are taught: the progression the LLM may sequence

The LLM never invents this ladder (PROJECT #4). It selects the next rung per child:

1. **Hear it** — Mibo models the sound exaggerated; child identifies it among foils ("Which one starts with sss?").
2. **Say it alone** — isolated sound with visible mouth cue (`/s/`: teeth together, smile, air hisses).
3. **Say it in syllables** — `sa, see, soo` / nonsense syllables.
4. **Say it in words** — initial (`sun, sock`), then final (`bus, mouse`), then medial (`dinosaur`-type or simpler `pencil`), per-sound ordering fixed in the library.
5. **Say it in a phrase** — "sun is hot", carrier phrases.
6. **Use it in play** — PA games and mini-games saturated with the target sound.

Mastery per rung feeds PROJECT #21 (model proposes, parent confirms) before advancing a full sound.

## 3. V1 exercise library (the source of truth the LLM picks IDs from)

Each library entry: `id`, target sound/rung, prompt script (bundled TTS line IDs), mouth cue (viseme sequence), word list, game type, success data to emit, parent tip seed. Minimum viable library for the hackathon (`/s/` only) and v1 (four sounds):

- **Warm-ups (all sounds):** lip/tongue play ("snake hiss", "tiger teeth", tongue taps) — 30–60s, no scoring.
- **Sound focus:** hear-it + say-it-alone for today's target.
- **Word practice:** 8–12 words per session drawn from the rung's list; US-English, picture-labelled, high imageability for 4–7s (`sun, sock, soap, seal, bus, mouse…` for `/s/` initial/final).
- **PA mini-games:** Rhyme match (does `sun` rhyme with `fun`?), First-sound hunt (find the picture that starts with sss), Syllable clap (clap `di-no-saur`).
- **Celebration:** star + sticker, summary line for the parent summary payload.

Open work: final word lists per sound/position, picture asset sourcing with licences, and per-exercise citation tags. Owner: founder research, days 1–3 of the hackathon plan for `/s/`; remaining sounds post-hackathon.

## 4. Assessment research notes

The sound adventure (PROJECT #3) samples each v1 sound at word level (2–3 words per sound) plus 3 PA probes (rhyme, first-sound, syllables). Output mapping is a *practice level*, deliberately coarse:

- Level = starting sound + rung per sound (e.g. "Start: /s/ in words; PA: rhyme emerging").
- Never output percent-correct as a child-facing or diagnostic score. Parent dashboard shows qualitative bands (Mastered / Improving / Still tricky).

## 5. Safety & claims guardrails derived from the research

- No "treats dyslexia/lisp/speech delay" language anywhere. Approved framing: "practise speech sounds and sound games informed by published research."
- If a parent questionnaire suggests red flags (e.g. very limited vocabulary for age, regression, hearing concerns), the app shows a gentle signpost to talk to a pediatrician/SLP. Signposting is information, not diagnosis, and its exact wording needs careful review before v1 release.
- Muscle/brain-pattern marketing language from the original pitch is **not** used: exercises are framed as practising sounds and listening skills, not "developing muscles/brain patterns proven to help."
