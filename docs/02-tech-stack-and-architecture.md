# 02 — Tech stack & architecture

Status: Draft. Decisions cite PROJECT.md by number. iOS only (PROJECT #9), no Mac locally — all builds are cloud builds.

## 1. Stack summary

- **App:** Expo (React Native) + TypeScript, EAS development build (not Expo Go — see §3), targeting iPhone + iPad, US English locale `en-US`.
- **Character:** Rive (`@rive-app/react-native`) viseme state machine (see `docs/03`).
- **Speech (on-device only, PROJECT #10):** candidates in §4; spike decides.
- **LLM:** Meta Model API (Muse Spark series) via Cloudflare Worker; Claude API fallback behind the same adapter (PROJECT #26, #32).
- **Storage:** on-device (expo-sqlite / MMKV-class) + optional iCloud sync post-hackathon (PROJECT #17). No mibo-operated child-data backend.
- **CI/distribution:** EAS Build + TestFlight (Apple Developer already enrolled, PROJECT #40). Codemagic remains an alternative builder; pick one pipeline in the build stage to avoid double config.
- **Budget:** free tiers + hackathon Meta Model API credits (PROJECT #41). Verify credit terms/count against the retention bar before relying on them.

## 2. Data flow (the privacy architecture)

```text
Child speaks ──> [ON DEVICE] mic -> speech recogniser -> word/phoneme result
                        │                │
                        │                └─> lesson reacts instantly (offline, PROJECT #23)
                        └─> local session record (device only)
Parent ends session ──> local summary builder (de-identified, PROJECT #11)
   summary = { ageBand, targetSound, rung, words: [{target, heardAs, attempts,
              parentMark}], paResults, sessionMinutes }   // no name, no audio, no free text
        │  (only with parental consent toggle ON, only when online)
        ▼
Cloudflare Worker (stateless, no logs/storage, holds API keys)
        ▼
Meta Model API ──fallback──> Claude API
        │  returns JSON: { plan: [libraryExerciseIds...], parentTip, dashboardText }
        ▼
App validates IDs against the local exercise library (reject anything unknown),
caches the week's plan on-device. Child never sees LLM output (PROJECT #22).
```

Rules that follow from the diagram:

- The LLM returns **IDs + parent-facing text only**. Unknown IDs are dropped; if the response is invalid/offline, fall back to a local default sequence from the library. A lesson never blocks on the network.
- Parent free-text (questionnaire "anything else?" fields) is stored on-device only and never included in a summary. Summaries are built from enum/structured fields by code, not by concatenating user text.
- API keys live only as Cloudflare Worker secrets. The public repo contains the Worker code with placeholder secret names, never values.

## 3. Why a development build, not Expo Go

Rive's React Native runtime "contains custom native code, [is] not compatible with Expo Go" and requires a development build (Rive Expo guide). The on-device speech options in §4 have the same property. Consequences:

- Day-1 setup: `expo-dev-client`, EAS iOS dev profile, install on the founder's iPhone/iPad via TestFlight/internal distribution.
- OTA JS updates (EAS Update) for script/content iteration; native rebuild only when native deps change. Budget build minutes accordingly (free tier first).

## 4. On-device speech: options & the spike

Hard rule: audio never leaves the device (PROJECT #10). Both leading options comply; neither gives true phoneme-level articulation scoring off the shelf (PROJECT #12).

- **Apple Speech (iOS 26 `SpeechAnalyzer`/`DictationTranscriber`; legacy `SFSpeechRecognizer` with `requiresOnDeviceRecognition = true`):** free, on-device, streaming, short-utterance support. Risks: tuned for typical adult/older-child speech; expect errors on 4–7 and atypical speech; word-level transcripts only. Check minimum iOS against the founder's devices before committing to the iOS 26 APIs vs the legacy recogniser.
- **WhisperKit (Argmax, MIT, CoreML):** open-source Whisper on Apple Silicon, iOS 17+, fully on-device. Risks: model download size, latency on older devices, Whisper's known tendency to "correct" mispronunciations toward the likely word (bad for scoring a lisp — it may hear `sun` when the child said `tun`). Must be tested adversarially on mispronounced targets, not just clean speech.
- **Phoneme-level (aim, not v1 gate):** no compliant off-the-shelf iOS SDK was found in this research pass. Treat as a time-boxed spike: forced-alignment / small CoreML phoneme classifier experiments on-device. Exit criterion: reliable `/s/` vs `/t/`-substitution detection on consented test recordings; otherwise v1 ships word-level + parent override (already designed, PROJECT #6).

**Spike plan (2 days max, early):** one harness screen that records prompts, runs both recognisers, and logs heard-as vs target for: founder adult voice, founder's 3-year-old (PROJECT #33), deliberately mispronounced targets. Decision rule: pick the recogniser with the lowest false-accept rate on mispronunciations (hearing the target when it was wrong), because false-accepts silently teach nothing. Write the result back into this doc.

Expo integration note: both options need native modules/config plugins in the dev build; prototype the harness as a minimal native module rather than assuming a maintained Expo speech plugin exists.

## 5. LLM inference contract

- **Adapter interface:** `generatePlan(summary) -> {exerciseIds, parentTip, dashboardText}` and `generateTip(summary)`. Implementations: `MetaModelProvider`, `ClaudeProvider`. Selection by env flag in the Worker; the app is provider-blind.
- **Prompt contract:** system prompt fixes role ("select from this library; return JSON only; never diagnose, never address the child"), includes the library index (IDs + rung), the summary JSON, and the band language rules (Mastered/Improving/Still tricky; signposting line only if the coded red-flag rule fired — the model does not invent signposting).
- **Validation:** schema-validate every response in the Worker; on failure, retry once, then return the local default plan marker. Log nothing (PROJECT #32); operational metrics, if ever needed, are counts only.
- **Retention check (blocking, pre-build):** read the current Meta Model API / hackathon-credit terms for retention and training use; document the finding here with date. If the terms fail PROJECT #26, default to Claude (verify its current zero-retention terms the same way) and use Meta models only where terms pass. Do not launch the Worker to real families until this row is filled in.
- **Cost shape:** one call per session-end (plan refresh) + optionally one per day (tip) per active family. Trivial at beta scale; summarised tokens are small. Cache the week plan locally (PROJECT #23).

## 6. Character/voice pipeline

Offline generation, bundled assets, no runtime synthesis: TTS lines + phoneme timings generated in a content pipeline, shipped in the app bundle / OTA asset pack, Rive driven by timings. Full detail: `docs/03`.

## 7. Offline, failure, and consent behaviour

- Airplane mode: lesson, scoring, Rive, TTS all work; summaries queue in an on-device outbox with a visible parent-facing "waiting to sync" state; nothing is sent silently later without the consent toggle still being on.
- Mic permission denied / recogniser unavailable: lesson degrades to "parent listens and taps" mode (parent marks each word). This is a first-class flow, not an error screen — it is also the accessibility fallback.
- Consent: separate, plain-language parental consent for (a) on-device listening and (b) optional anonymous summary sharing, inside the parental gate. (b) defaults off for the hackathon demo build; COPPA treats child voice as personal information requiring verifiable parental consent (see `docs/04` §6), which is another reason audio stays on-device and transcripts are treated as sensitive even locally.

## 8. Repo layout (proposed, build stage will create)

```text
app/            Expo app (TypeScript)
worker/         Cloudflare Worker (stateless LLM proxy)
content/        Exercise library JSON, word lists, TTS scripts
assets/         Mibo Rive file, generated voice lines + timings (licence-checked)
docs/           These documents
```
