# 04 — Product & lesson design

Status: Draft. Implements PROJECT #2–#6, #16–#24, #38. Educational practice only — no diagnosis, no guarantees (PROJECT #1).

## 1. Users & jobs

- **Parent (buyer, account holder):** "Help me practise the right things for 5 minutes a day, and show me it's working." Holds the gate, consent, subscription (post-hackathon), and dashboard.
- **Child, 4–7 (user, never customer):** "Play with Mibo, collect stickers." Never sees scores, prices, settings, or failure.

## 2. First-run flow

1. **Parental gate + consent (parent only).** Plain-language: what mibo is/isn't, on-device listening explanation, separate optional toggle for anonymous summary sharing (PROJECT #11), mic permission. No child screens before this completes.
2. **Parent questionnaire (~3 min):** age (stored as band), sounds the parent has noticed are hard (pick-list mapped to library sounds), languages at home (v1 modelling is US English — say so honestly), hearing/professional-support context (used only for signposting copy, `docs/01` §5).
3. **Sound adventure (child + parent, ~5 min in v1; ~1 min `/s/`-only in the hackathon slice):** Mibo invites the child to say pictured words; PA probes as games. On-device scoring per `docs/02` §4; parent can tap "he said it" throughout — adventure data records parent marks alongside model results.
4. **Result (parent-facing wording, child-facing party):** child gets a celebration + first sticker. Parent gets the practice level in words: "Starting with sss sounds in words, and rhyming games." No scores, no percentiles, no disorder words.

## 3. The daily session (parent-built, PROJECT #5)

Before starting, the parent sees today's suggested mix and can toggle blocks. Defaults scale with the child's rung; total estimated time is shown honestly ("About 4 minutes").

- **Warm-up (~1 min):** mouth play. No scoring.
- **Sound focus (2–3 min):** hear-it + say-it on today's rung.
- **Word practice (3–4 min):** 8–12 words, Mibo models with exaggerated viseme hold, child repeats, gentle loop per PROJECT #6 (max 2 re-models per word, then move on smiling — the plan, not the child, remembers it was tricky).
- **Mini-game (2–3 min):** rhyme / first-sound / syllable game using the same target words (Gillon interleave, `docs/01` §1).
- **Celebration (~30 s):** stars + sticker (PROJECT #38), spoken summary template for the child, session closes.

Session loop rules: listening state times out kindly ("Mibo didn't hear — tap when you're ready"); noisy-room hint after repeated no-hears; a visible parent-held stop button; the child can always finish at a block boundary, never mid-word with a locked screen.

## 4. Scoring experience (PROJECT #6, #12, #21)

Child-facing: encouragement + re-model only; effort praised specifically ("You kept your teeth together!") from scripted variants.
Parent-facing (after the session, or via a discreet parent corner during): per-word heard-as, attempts, and the override control. Overrides are first-class data: the summary marks `parentMark` separately so plan logic can weight parent judgement over a shaky model.
Mastery: model proposes when a rung clears its trend bar across sessions; parent confirms on the dashboard; only then does the plan advance (PROJECT #21). Demotion is silent (more practice at the same rung), never announced.

## 5. Parent dashboard (PROJECT #19)

Home tab after gate: per-sound bands (Mastered / Improving / Still tricky), sessions this week (a calm count, not a streak to break), history list, today's home-practice tip (LLM, `docs/02` §5; template fallback offline), and the mastery-confirmation cards. Copy rules: bands and behaviour ("said *sun* clearly 4 times") over numbers; every chart answerable with "so what do we play tomorrow?"

## 6. Guardrails, trust & store readiness

- Parental gate guards: settings, consent toggles, dashboard, purchases, external links (PROJECT #16–#18). Gate type: a parent-action check a 5-year-old can't pass but a tired parent can (e.g. hold-for-3-seconds + simple adult instruction), reviewed against Apple's current Education-category expectations at build time.
- COPPA posture: child voice is personal information; verifiable parental consent precedes collection (our consent flow §2), audio is processed on-device and not retained as files by default, summaries are anonymous and opt-in. This doc is a design posture, not legal advice — pre-launch legal review is a v1 gate in `docs/05`.
- App Store copy rules: "practise speech sounds", "informed by published research", mandatory not-a-replacement line; screenshots show parent + child framing; no before/after or outcome imagery.
- Offline/degraded honesty: if scoring is unavailable, the app says parent-tap mode is on (PROJECT `02` §7) rather than pretending to listen.

## 7. Hackathon slice mapping

Same flows, narrowed per PROJECT #31: 3–4 questionnaire questions, `/s/` adventure (4–6 words + 1 rhyme probe), parent block-picker with warm-up/sound-focus/word-practice, one dashboard, one LLM-generated plan + tip. Build the real components with the full library schema so post-hackathon sounds slot in as content, not code.
