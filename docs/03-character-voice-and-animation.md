# 03 — Character, voice & animation

Status: Draft, updated by PROJECT #46. Mibo is the founder's mint round blob from `assets/mibo-wave.gif`, a **wise teacher** (PROJECT #25), voiced by a **licensed TTS character voice** (PROJECT #13, #37). **Current direction (#46):** a code-drawn puppet in a hand-drawn watercolour and coloured-pencil style, with motion held like hand animation (body 6 fps, mouth 24 fps, line boil 3 fps), prototyped in `prototypes/mibo-puppet/` (see §0). The earlier sprite poses in `assets/character/` (PROJECT #44) remain as reference art. The Rive design in §2 is parked.

## 0. Puppet Mibo (current)

- **Rig:** one flat parameter set drives a deformable jelly body, eyes (blinks, lids, happy arcs), floating brows, a parametric teaching mouth (s, th, sh, f, m/b/p, l, vowels) and two arms that grow out of the body. Mibo can turn around so the other arm comes to the front. The mouth stays clear of the eyes by sliding down like a dropping jaw.
- **Life:** springs for squash and stretch, idle breathing, blinks, glances and fidgets, moods (happy, listening, thinking, surprised, gentle, silly), one-shot moves (hop, turn, wave, celebrate, wiggle, boop) and a "watch my mouth" zoom for teaching moments.
- **Look:** watercolour washes with pooled edges and paper granulation, coloured-pencil outlines, pencil hatching, slightly offset colour. No canvas filters (iOS Safari lacks them); each step maps to Skia path effects and shaders.
- **Timing (tunable, `Mibo.STYLE`):** body poses held at 6 fps; the mouth swaps shapes at 24 fps, each frame showing the shape targeted longest in its window; lines boil at 3 fps and a boil redraw never adds motion.
- **Lip sync:** today a rough text-to-mouth-shape timeline stands in for audio. With live TTS the same mouth track comes from the audio (`docs/06` §4).

## 1. Character design brief (for generation)

Generate concepts against this brief, not open-ended "cute mascot":

- Round, soft body; front-facing; **one big, highly readable mouth** at small phone sizes; visible tongue and teeth (needed to model `/s, th, l/`); simple silhouette ears/horns/tuft for recognisability in silhouette.
- Gender-neutral palette; no clothing that dates or genders; no beak, no snout that hides the mouth (PROJECT #36 rules out birds).
- Expression range required by scripts: neutral-teacher, encouraging, listening (head tilt, mouth closed), celebrating, "watch me" (mouth exaggerated on the target sound).
- Output needed: clean front-facing reference + expression sheet. Generated images are *reference art*: the shipping character is rebuilt as clean vector shapes in Rive so mouth shapes stay crisp and animatable. Do not ship raw generated raster as the in-app character.

**Rights check (blocking before demo use):** confirm the current Meta image-generation terms grant the rights needed for a public demo + later commercial app use of generated character art, and record the finding (tool, date, terms clause) here. Hackathon rules disqualify projects using assets without rights — treat an unclear answer as a no, and fall back to an original hand-drawn simple character (same brief).

## 2. Rive rig

State machine driven by the lesson engine (inputs, not hardcoded timelines):

- `viseme` (number): current mouth shape index — the core teaching surface.
- `expression` (number/enum): neutral / encouraging / celebrating / listening / proud.
- `speaking` (bool), `blink` (trigger), `celebrate` (trigger), `listen` (bool).

Viseme set (8–12 shapes covers US English teaching needs): rest/closed (`m, b, p`), wide smile (`ee`), open (`a` as in *cat*), round (`oo`), teeth-together hiss (`s, z`), lip-teeth (`f, v` — expansion sounds, include shape early, cheap), tongue-tip (`l, th` shapes for modelling), `sh/ch` pucker, plus an exaggerated `/s/` hero shape held longer during "watch me" moments.

Sync method: offline TTS generation emits phoneme timings (see §3); a bundling step maps phonemes → viseme indices into a per-line JSON track; at runtime the player sets `viseme` per timestamp while the audio plays. Interpolated mouth transitions in Rive avoid popping; exaggerate hold time on the target sound of each line (this is a teaching cue, not a bug).

**Fallback (PROJECT #35):** if the Rive viseme loop is not working by mid-hackathon, ship frame-based mouth sprites over the static character for the demo and keep the lesson engine's viseme track format unchanged, so Rive drops in later without re-authoring content.

## 3. Voice: licensed TTS character

Requirements (scored in the day 1–2 pick, PROJECT #37):

- Child-appropriate, warm teacher voice; US English (PROJECT #24); consistent character across hundreds of short lines.
- **Phoneme/word timing output** (or an alignment step we run offline) — without timings, viseme sync degrades to mouth-flapping, which PROJECT #14 rejects.
- Offline generation + app bundling rights; commercial/App Store licence; cost compatible with PROJECT #41 (free tiers + hackathon credits).

Research finding that shapes the pick: e.g. ElevenLabs' free tier is roughly 10k credits/month (~10 min of speech) and is **personal/non-commercial use only**, with commercial rights starting on paid tiers (~$6/mo Starter class). Our whole v1 script is short lines, so free-tier *volume* may suffice for the hackathon; the *licence* is the problem. Decision rule for the research pick:

1. Prefer a vendor whose free/hackathon-credit terms explicitly allow public demo use of generated audio.
2. If none does, surface the cheapest compliant paid exception to the founder for approval (PROJECT #41 tension) — do not quietly ship non-compliant audio, and do not fall back to a raw Apple system voice for the demo (it reads robotic and breaks the character; Apple TTS remains acceptable only as the in-app *degraded* fallback for ungenerated dynamic text post-v1).
3. Evaluate in the same pass: PlayHT / Resemble / Cartesia-class APIs and any kids-voice specialists, scored on the five PROJECT #37 factors; record the table here when done.

Content pipeline: script lines live in `content/` with IDs → generation script (keys in local env / CI secrets, never in repo) → audio + timings → normalised loudness → bundled. Re-generation is per-line, so script edits stay cheap.

## 4. Script & personality rules

- Mibo is the expert who makes it safe: "Watch my mouth… sss-sun. Your turn!" Never "wrong", never disappointed (PROJECT #6, #25).
- Mibo's final model of a target word is always correct (PROJECT #25 guardrail). Mibo never models the child's error back except inside a coded "hear the difference" contrast that ends on the correct form.
- Lines are written, reviewed, and bundled — no generated-at-runtime child-facing text (PROJECT #22). Branching lines keyed by lesson events: first try, retry, parent-overridden, game win, session end.
- Session language budget: Mibo talks in 3–7 word sentences for the child; explanation lives on parent screens.

## 5. Demo-critical asset list (hackathon slice)

For `/s/` only (PROJECT #31): ~40–60 short lines (greetings, warm-up, `/s/` modelling set, encouragement variants ×5, celebration), `/s/` word models ×12, rhyme/first-sound prompts. Generate once, bundle, and freeze scripts by the content-freeze day in `docs/05` so the demo video is shot against final audio.
