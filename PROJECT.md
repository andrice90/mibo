# mibo — Project Decisions

Status: **Draft** (grill complete 2026-10-26 — decisions below are settled by the founder in-session; scope for the document phase accepted at #43; document becomes Final only on explicit acceptance of the finished docs)

## Product in one line
AI-assisted speech-practice companion for families. A playful animated character (Mibo) guides 4–7 year-olds, with a parent alongside, through short speech lessons personalised from an initial assessment. Educational practice only.

## Settled decisions

| # | Decision | Settled choice |
|---|---|---|
| 1 | Legal positioning | **Educational speech-practice companion (B).** No diagnosis, no treatment claims, no guarantees of any sort. Positioned as practice between / instead of waiting for professional support, never a replacement for a speech-language pathologist. |
| 2 | First audience | **Ages 4–7, parent co-play.** Focus: articulation + phonological awareness (overlap of lisp-type errors and early dyslexia-risk reading foundations). Slow-talker (<4 vocabulary) support deferred. |
| 3 | Assessment | **Both (C):** parent questionnaire + playful 5-min child "sound adventure" with recorded (on-device) speech tasks. Output is a *practice level* (e.g. "Level 2: S-sounds + rhyming"), never a diagnosis or disorder label. |
| 4 | Plan authorship | **Hybrid (C):** human-researched, evidence-backed exercise library is the source of truth. LLM selects, sequences, and personalises from that library. LLM never invents therapy exercises. |
| 5 | Session shape | **Short by default; 8–12 min is the ceiling, not the target.** Parent selects today's exercise/game mix before the session starts (e.g. warm-up + sound focus only ≈3–5 min on a busy day; full stack on a good day). Building blocks: warm-up mouth moves, sound focus, word practice, mini-game, celebration. |
| 6 | Scoring in the moment | **Gentle hybrid (C):** speech model scores in background; child only hears encouragement + a better model ("watch my mouth: sss-sun"). No fail states / red X. Parent can override ("He got it" / "Still tricky"). Score feeds plan + progress, not the child's face. |
| 7 | Character form | **Original gender-neutral monster/animal (B).** Big exaggerated mouth, visible tongue. Learns *with* the child; can model errors playfully. Not a human child character. |
| 8 | Runtime commitment | Not locked to pure Expo Go. Founder has no Mac; CI is Codemagic. EAS / dev builds acceptable. |
| 9 | Platform | **iOS only for v1.** Cloud Macs (EAS/Codemagic) for builds, TestFlight for distribution. Apple Developer account required. Android parked. Stay on Expo/EAS (one TypeScript codebase), not Swift-native dual builds. |
| 10 | Child audio privacy — HARD RULE | **No audio ever leaves the device (B).** Only a text summary may reach a cloud model. No exceptions in v1. |
| 11 | Cloud LLM boundary | **De-identified text summaries only (A).** E.g. age band, target sound, target word, attempts, heard-as, score trend, parent mark. No name, no audio, no identifying free text. Parents can opt out of even this. |
| 12 | Scoring fidelity path | **Aim phoneme-level, prove word-level first.** Lesson loop ships on word-level on-device scoring ("asked *sun*, heard *tun/sun*"); time-boxed spike on phoneme-level articulation scoring in parallel. Parent override covers the gap. |
| 13 | Mibo's voice | **Licensed TTS character voice.** Not a raw Apple system voice. (Generation timing/bundling to be confirmed in tech docs.) |
| 14 | Mouth animation | **Viseme mouth library in Rive (B).** Distinct mouth shape per sound group, sequenced to TTS phoneme timings. Simple mouth-flapping rejected; full 3D/Live2D rejected for v1. |
| 15 | Exercise credibility | **Solo-researched for now (A).** Founder researches papers/programs and cites them in-app. **Risk flagged:** no SLP advisor in v1; SLP review is the first upgrade before any efficacy language. |
| 16 | App Store category | **Education + in-app parental gate (B),** not Apple Kids Category. Same practical protections (no ads, no child-data sale, parental consent) without Kids-Category restrictions breaking the summary pipeline. |
| 17 | Profile/progress storage | **On-device first, optional iCloud sync via parent's Apple ID (C).** No child-data backend operated by mibo in v1. Cloud LLM calls stateless (summary in, plan out, nothing retained server-side). |
| 18 | Business model | **Parent subscription (A),** free assessment + trial lessons, paywall behind parental gate only. |
| 19 | Parent experience | **Parent dashboard (B):** sounds/words mastered vs still tricky, streaks, session history, one short "practise this at home" coaching tip per day generated from the de-identified summary. Community/SLP-chat/printables (C) out of v1. |
| 20 | V1 sound scope | **Sibilants first (A):** `/s, z, sh, ch/` plus phonological-awareness games (rhyme, first-sound identification, syllable clapping). `/r, l, th, f, v/` etc. are the first content expansion, not v1. |
| 21 | Mastery / progression | **Both (C):** speech model proposes "looks mastered" (score trend across sessions), parent confirms on the dashboard before the plan advances. No fully automatic promotion. |
| 22 | LLM-to-child boundary | **No freeform LLM to child (B).** Child hears only pre-scripted bundled Mibo lines (licensed TTS character voice, offline). LLM output reaches parents only: plan selections (IDs from the library), dashboard text, daily home-practice tip. No unreviewed generative output reaches the child. |
| 23 | Connectivity | **Offline-first (B).** Week's plan generated ahead and cached on-device; today's lesson always runs offline (scoring, Rive, bundled TTS). De-identified summaries queue and sync to the LLM when connectivity returns. |
| 24 | Language / accent | **US English first (B).** Licensed TTS voice, word lists, and phonics modelling in US English. UK English as a later voice pack. |
| 25 | Character role | **Wise teacher (A)** — founder chose teacher over fellow-learner. Mibo always knows and models correctly; child copies the expert. Guardrail unchanged: Mibo's final model of a target word is always correct. Personality scripts must avoid shaming ("watch me, then your turn"). |
| 26 | LLM provider contract | **Hard terms (B):** zero/shortest retention, no training on inputs, provider-agnostic adapter. Preferred candidates: **Meta Model API (Muse Spark series) first, Claude API as alternative** — final pick by eval of plan-selection/parent-text quality in the research phase (incl. verifying Meta Model API terms + hackathon credit terms actually meet the retention bar). Note: hackathon provides Meta Model API access/credits; "Meta AI API" in session = Meta Model API. |
| 27 | Pre-launch validation | **Closed TestFlight beta first (B):** 5–10 families, pass bars on lesson completion, unaided parent-run sessions, repeat-practice intent, and scoring/override trust. App Store + subscription after beta. "Works" in v1 = usable, trusted practice habit, not clinical efficacy. Recruiting source for those families: still open. |
| 28 | Team / build mode | **Solo software developer (A),** building with Muse models (Wonder + Spark) as the dev team. Contract only specialist pieces if needed (character art / Rive rig is the prime candidate). Built for the **Meta AI Hackathon** — this is also the reason Meta AI API is the first-choice LLM. |
| 29 | Hackathon constraints | **Meta Global AI Developer Hackathon, Oct 26–Nov 4. Submit by Wed Nov 4, 9:00 PM ET** via Cerebral Valley. New work only (built during the event); demo must show only what the team built in-event; **public repo required; 3-minute demo video required** and heavily scored; max 4 people, solo allowed; one track only (Indie Developer or Startup). Waiver: 18+, no Meta/CV staff/contractors/government-affiliated or their households. **Banned-project risk to design around:** "AI medical or health advice" and generic "AI for education" chatbots are disqualified — mibo's positioning (educational practice, no diagnosis/advice, no freeform LLM chat with the child) is the mitigation and must be explicit in the demo/pitch. |
| 30 | Hackathon entry | **Indie Developer track + "Build for Your World" theme.** Solo entry. Story: Meta AI + on-device speech scoring for family speech practice, child audio never leaves the phone. |
| 31 | Hackathon deliverable (Nov 4) | **Single-sound vertical slice, polished (A):** short parent questionnaire → 1-min `/s/` sound adventure → ~4-min parent-selected lesson with Rive viseme Mibo + licensed TTS → on-device word-level scoring + parent override → Meta AI API (de-identified summary) → practice plan + parent tip → simple dashboard. Everything else locked in this log is post-hackathon v1 roadmap, not Nov 4 code. |
| 32 | LLM hosting | **Thin stateless Cloudflare Worker proxy (B)** on founder's existing Cloudflare account. Holds Meta AI (and Claude fallback) keys, forwards de-identified summaries only, returns plan/tip, stores/logs nothing. No API keys in the app or public repo. |
| 33 | Testing + demo voices | **Hybrid:** founder (adult voice) for dev iteration, plus founder's own 3-year-old for real-child testing/demo with founder-as-parent consent. **Caveats logged:** tester is below the 4–7 target band (scoring/session behaviour must not be over-fitted to a 3-year-old); no full name or identifying details in any public material. |
| 34 | Demo child exposure | **Voice + hands/screen only (B).** No face, no name in the public demo video or repo. Camera on phone/Mibo; child's voice heard responding. |
| 35 | Character creation (hackathon) | **Meta AI-generated character art** (founder's choice), then founder-built Rive viseme rig from that art (simple shapes, big mouth, expression states). Frame-sprite fallback (C) remains the declared slip-plan if the viseme loop isn't working by mid-hackathon. Must verify generated-asset rights for public/commercial use in research doc. |
| 36 | Character form (locked detail) | **Friendly round character/animal (A).** Round body, front-facing big mouth readable on a phone screen. Beaked/bird forms ruled out (cannot show tongue/teeth for `/s, th, l/`). |
| 37 | TTS vendor | **Open — research doc to shortlist and pick on day 1–2.** Scored on: child-appropriate US-English character voice, phoneme/viseme timing output for Rive, offline generation + bundling, commercial/App Store licence, cost. No vendor pre-selected. |
| 38 | Child rewards | **Calm collection (A):** stars + sticker book that only grows. No streak loss, no timers, no expiring rewards, no daily-quest pressure. Reward-side expression of the no-fail rule. |
| 39 | Test hardware | Founder has **iPhone + iPad** for TestFlight testing and demo filming. No local Mac; cloud builds only. |
| 40 | Apple Developer | **Already enrolled** in the Apple Developer Program. TestFlight/App Store Connect available from day 1. |
| 41 | Hackathon budget | **Near-zero (A) — free tiers only.** **Tension flagged for research doc:** decision 13 (licensed TTS character) must be satisfiable on a free tier with rights to use output in a public demo, or the doc must name the cheapest compliant exception for founder approval. Demo voice quality is a scored surface; do not silently fall back to a robotic system voice. |
| 42 | Public repo | **Already created: `github.com/andrice90/mibo`, checked out as `main` in this workspace with `origin` set** (verified in-session: branch `main`, no commits yet). New-work-only history starts with the docs. |
| 43 | Document-phase scope (accepted) | **Founder accepted:** `PROJECT.md` + `README.md` (project intro/purpose) + 5 docs under `docs/` (research/curriculum, tech stack/architecture, character/voice/animation, product/lesson design, hackathon phased plan + v1 roadmap). Out of scope this phase: app code, video production, later-stage build approvals. Docs phase done = docs in repo, decisions reflected, open items named as open. Founder instruction: commit the README, build out the docs, commit and push. |

## Non-negotiables
- No diagnosis, no treatment guarantees, no disorder labels for a child.
- No child audio leaves the device.
- No fail states shown to the child.
- LLM selects from a human-researched library; it does not invent exercises.
- All purchases, settings, cloud-consent, and external links behind a parental gate.

## Open items (owned by the docs / spikes, not left vague)
- On-device speech pick (Apple SpeechAnalyzer/`SFSpeechRecognizer` vs WhisperKit/CoreML vs phoneme spike) — `docs/02`, decided by spike exit criteria
- Meta Model API terms (retention/training, hackathon credits) verified against decision 26; Claude fallback contract — `docs/02`
- TTS vendor pick under free-tier + licensing constraint — `docs/03`, day 1–2 of hackathon plan
- Exercise library v1 content (word lists, progressions) + citations — `docs/01` + `docs/04`
- Beta family recruiting source (post-hackathon) — `docs/05`, still open
- Generated-character asset rights verification — `docs/03`

## Out of scope for v1 (parked)
Android, slow-talker (<4) track, SLP marketplace/chat, community, printables, Kids Category, child-data backend, efficacy claims/study.
