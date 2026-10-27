# 05 — Phased plan: hackathon slice → v1

Status: Draft. Hard deadline: **submit Wed Nov 4, 9:00 PM ET** (PROJECT #29). Solo dev + Muse (Wonder/Spark), Indie Developer / Build for Your World (PROJECT #28, #30). Every phase ends with a gate the founder explicitly approves — finishing a phase never auto-approves the next.

## Phase 0 — Docs & decisions (Oct 26) ✅ this package

PROJECT.md decision log, README, docs 01–05. Gate: founder accepts docs (turning PROJECT.md Final) before build code starts.

## Phase 1 — Hackathon build (Oct 27 – Nov 4): the `/s/` vertical slice (PROJECT #31)

Day-by-day, assuming ~one focused dev. Adjust dates, not scope order: each day's exit test is demoable.

- **Day 1 (Oct 27) — Foundations.** EAS dev build running on iPhone + iPad; repo CI for the Worker skeleton; TTS vendor pick closed (`docs/03` §3 decision rule); Meta Model API retention check written into `docs/02` §5 (blocking). Exit: blank app + Mibo placeholder on device via TestFlight/internal build.
- **Day 2 (Oct 28) — Speech spike.** Harness per `docs/02` §4 (Apple Speech vs WhisperKit, mispronunciation false-accept test). Character concepts generated from the `docs/03` §1 brief; founder picks. Exit: recogniser chosen and written into `docs/02`; Mibo reference art picked.
- **Day 3 (Oct 29) — Lesson engine.** Library schema + `/s/` content (words, scripts); session runner with parent block-picker; scoring + override; local storage + summary builder. Mibo voice lines v1 generated (licence-checked). Exit: full lesson playable with a static Mibo image.
- **Day 4 (Oct 30) — Mibo comes alive. Decision point.** Rive viseme rig + timing tracks wired to bundled audio. **Slip rule (PROJECT #35):** if viseme sync isn't demo-clean by end of day, switch to sprite fallback and protect the remaining schedule. Exit: Mibo models `sss-sun` with a teaching mouth.
- **Day 5 (Oct 31) — LLM loop.** Worker live: summary → Meta Model API → validated plan IDs + parent tip → dashboard bands; offline queue + fallback plan. Exit: finish a lesson, watch the dashboard change, airplane-mode lesson still works.
- **Day 6 (Nov 1) — Polish & harden.** Consent/gate flow, degraded modes, noisy-room handling, sticker book, session timing vs the 3-year-old reality check (PROJECT #33 — attention, tap targets; remember he's below the target band). Exit: founder + son complete the slice unaided.
- **Day 7 (Nov 2) — Content & demo freeze.** Script/audio freeze; demo shot list locked to the 3-minute outline below; rehearse timing. Exit: rough-cut recorded (screen + voice only, PROJECT #34).
- **Day 8 (Nov 3) — Video & submission package.** Edit 3-min video, public-repo README/polish, submission form (track, theme, credits/contributions statement: new work only, PROJECT #29). Exit: submission draft complete a day early.
- **Day 9 (Nov 4) — Submit by 9:00 PM ET.** Buffer day for build/video failures. Submit in the morning ET if possible; no new features.

Demo video outline (3:00): problem in one lived sentence (0:00–0:20) → sound adventure with a real child's voice, screen-only (0:20–0:50) → Mibo's viseme teaching moment + parent-built short lesson (0:50–1:50) → scoring/override honesty beat (1:50–2:10) → Meta-AI plan + parent tip on the dashboard, privacy line stated out loud ("his voice never left this phone") (2:10–2:40) → what v1 adds + closing (2:40–3:00). State the banned-category mitigation plainly: educational practice, no diagnosis, no AI chat with the child.

## Phase 2 — Post-hackathon v1 (weeks, gated separately)

1. Remaining sounds `/z, sh, ch/` content + PA game set; library citations pass (`docs/01` §3 open work).
2. Phoneme spike round 2 (only if `docs/02` §4 exit criteria justify it).
3. iCloud sync, subscription (StoreKit) behind the gate, UK-English voice pack scoping.
4. Closed TestFlight beta, 5–10 families (PROJECT #27) — **recruiting source still open; name it before this phase starts.** Pass bars per PROJECT #27; fix scoring trust issues before any public launch.
5. Pre-launch gates: SLP review of the library (PROJECT #15 upgrade), legal/privacy review (COPPA + App Store), generated-asset/TTS licence audit.

## Phase 3 — Later (named, not scheduled)

Android, `/r, l, th, f, v/` expansion, slow-talker (<4) track, Kids Category re-evaluation, efficacy study design. Each returns for its own interview/approval (PROJECT #43 scope rule).

## Risks that can kill the deadline (watch daily)

- Rive viseme rig overrun → sprite fallback (Day 4 rule).
- Recogniser false-accepts mispronunciations → parent-tap mode becomes the demo path; scoring framed as assistive, which the design already supports.
- TTS licence blocks public audio → Day 1 pick uses the `docs/03` decision rule; cheapest-compliant-exception decision escalated to founder immediately, never silently.
- Meta Model API terms fail the retention bar → Claude becomes primary behind the same adapter; Meta usage story told honestly in the submission (built with Muse/Meta tooling), terms finding documented in `docs/02`.
