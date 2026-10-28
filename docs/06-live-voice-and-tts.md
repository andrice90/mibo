# 06 — Live voice pivot & TTS discovery

Status: Draft, 2026-10-28. Records the founder's pivot (PROJECT #45) and the TTS discovery that gates the MVP build. Pricing is from OpenRouter's live model list on 2026-10-28. Sound quality is **not yet measured**: the bake-off harness is built and tested but needs an OpenRouter inference key to run (see §5).

## 1. The pivot

Before: Mibo spoke only pre-scripted, bundled lines. The cloud saw de-identified summaries after the session (PROJECT #10, #11, #22, #23).

After: Mibo responds **live** to how the child is doing. Each turn, the recogniser's words (never audio) plus lesson context go to an LLM, which writes Mibo's next short line. Live TTS speaks that line and Mibo's mouth follows the new audio. Mibo can react to the actual attempt ("I heard *tun*, let's put our teeth together: sss... sun!") instead of choosing from five canned encouragements.

What stays:

- **Child audio stays on the device.** Only recognised text leaves it.
- **The adult is part of the product.** A clear disclaimer before every session: a parent or adult supervises, Mibo is a practice companion and not a therapist, and replies are AI-generated.
- **The exercise library stays the source of truth** (PROJECT #4). The LLM writes the *words around* an exercise. It does not invent exercises.
- **Mibo's model of a target sound is always correct** (PROJECT #25). This is the main constraint on the TTS choice (§3).

## 2. What OpenRouter offers today

OpenRouter now has one OpenAI-compatible speech endpoint, `POST /api/v1/audio/speech`, with fields `model`, `input`, `voice`, `instructions`, `response_format` (`pcm` | `mp3`) and `speed`. It returns raw audio bytes. **No model on it returns word, phoneme or viseme timestamps.** Gemini TTS reads `input` verbatim, so delivery directions go in `instructions`, and Gemini returns PCM only.

Candidates under test. $/min assumes about 900 characters per spoken minute, and Gemini's documented 25 audio tokens per second:

| Model (OpenRouter id) | Price | ≈ $/min of speech | Notes |
|---|---|---|---|
| `google/gemini-3.8-flash-tts` | $0.50 in / $9 out per 1M tokens | ~$0.014 | Founder has used Gemini TTS before. Steerable with `instructions`, 30 voices, PCM only. |
| `google/gemini-3.8-flash-lite-tts` | $0.50 / $6 per 1M tokens | ~$0.009 | Faster, high-throughput tier. |
| `google/gemini-3.1-flash-tts-preview` | $1 / $20 per 1M tokens | ~$0.03 | Older preview. Shown for comparison only. |
| `hexgrad/kokoro-82m` | $0.62 per 1M chars | ~$0.0006 | Open weights (Apache-2.0). Could later run fully on-device. |
| `canopylabs/orpheus-3b-0.1-ft` | $7 per 1M chars | ~$0.006 | Expressive open model. |
| `microsoft/mai-voice-2.1-flash` | $15 per 1M chars | ~$0.014 | |
| `x-ai/grok-voice-tts-1.0` | $15 per 1M chars | ~$0.014 | 5 voices. |
| `fish-audio/s2.1-pro` | $15 per 1M chars | ~$0.014 | Has a `:free` variant for prototyping. |
| `deepgram/aura-2` | $30 per 1M chars | ~$0.027 | |
| `elevenlabs/eleven-flash-v2.5` | $40 per 1M chars | ~$0.036 | Low latency. |
| `elevenlabs/eleven-v3` | $80 per 1M chars | ~$0.072 | Most expressive, priciest. |
| `minimax/speech-2.8-turbo` | $60 per 1M chars | ~$0.054 | MP3 only. |

Cost per lesson: if Mibo speaks about 1.5 minutes in a 5-minute lesson, Gemini Flash is about **$0.02**, Kokoro about **$0.001** and ElevenLabs v3 about **$0.11**, plus a fraction of a cent of LLM tokens. Every option except ElevenLabs/MiniMax fits a free-tier-ish hackathon budget (PROJECT #41).

Outside OpenRouter, two older engines have what the LLM voices lack: **deterministic phoneme control and viseme timing**. Azure Speech gives viseme events, SSML `<phoneme alphabet="ipa">` and an en-US child voice. Amazon Polly gives viseme speech marks, SSML phonemes and child voices. They sound flatter than the LLM voices. They are the fallback if no LLM voice can reliably hold an `/s/`. These details come from prior knowledge and must be re-verified before relying on them.

## 3. The real risk: teaching sounds, not sentences

Every modern voice reads "Great try! Let's do it again" well. The open question is the **teaching sounds**:

- `Sssss` read as the letter name *ess*, or skipped.
- `Thhhh` read as *tee-aitch*, or turned into a voiced `/ð/`.
- An `/s/` that drifts towards `/sh/`. That would teach the very lisp-adjacent error we are trying to help with.
- Vowels clipped short, or each one pronounced differently from one take to the next. LLM-based TTS is non-deterministic, so the same text can come out differently each time.

**Design decision this leads to (recommended, independent of vendor):** split Mibo's speech into two kinds of segment.

1. **Talk segments.** Live LLM text goes through live TTS. Any small imperfection here is harmless.
2. **Model-sound segments** (`/s/` hiss, `/θ/`, held vowels, the target word said slowly). These are **not generated live**. They are generated once in the same voice, checked automatically (§4) and by ear, and bundled as clips. The LLM references them by ID: `{"say": "Watch my mouth"}, {"model": "s_hold"}, {"say": "sun! Your turn."}`. The app plays them back to back.

This keeps the live, personal feel while making the bit that actually teaches deterministic and correct. It also means the TTS vendor only has to be *good enough* at the teaching sounds once, offline, where we can regenerate until a take passes.

## 4. Lip sync without timestamps

Since no OpenRouter voice returns timing, Mibo's mouth is driven **from the audio itself**. That is cheap and vendor-independent, and at Mibo's 3–4 fps cartoon rate it only needs one pose per 250 ms window:

- **silence → `rest`** (RMS below about −28 dB re peak)
- **voiced → a vowel pose** picked by formants (LPC): low F1 + high F2 = `ee`, low F1 + low F2 = `oo`, high F1 = `ah`, else `oh`/`eh`
- **unvoiced high-band noise → a fricative** by spectral centroid: above 5.2 kHz is `/s, z/`, 3–5.2 kHz is `/sh/`, lower and flat is `/f, th/`. These borrow the nearest existing mouths (`ee`, `oo`, `eh`) until consonant poses are drawn.
- **model-sound segments** use the exact authored pose instead, held for the clip, e.g. a teeth-together `/s/` pose. This needs new sprites: `s`/`z` teeth, `th` tongue-between-teeth, `sh` pucker, `f` lip-on-teeth, `m/b/p` closed.

The same analysis runs in the browser/app on the PCM as it arrives (Web Audio `AnalyserNode` or a few lines of JS FFT). It is prototyped in Python in `tools/tts_eval.py` (`analyze`, `mouth_track`) and unit-tested on synthetic sounds in `tests/test_tts_eval.py`.

## 5. Bake-off harness (built, waiting on a key)

`tools/tts_eval.py` sends 17 clips through 14 candidate voices:

- isolated `s, z, sh, th, f`
- held `ah, ee, oo, oh, eh`
- `/s/` and `/th/` words
- Mibo modelling lines
- a minimal pair, and a "live feedback" line

For each clip it records time-to-first-byte (live latency), duration, real cost (from the generation record) and the acoustic verdict. The acoustic check flags *letter name instead of hiss*, *hiss too short* and *wrong place, e.g. /sh/ instead of /s/*. Vowels get a formant guess. An optional `--judge` pass asks an audio-input LLM for a narrow IPA transcription. It writes `eval/tts/out/index.html`, a listening page where every clip plays with **Mibo's mouth animated from that clip's audio**, so we judge sound and sync together.

```sh
OPENROUTER_LLM_API_KEY=sk-or-v1-... python3 tools/tts_eval.py            # all 14 candidates (~$0.30 total)
python3 tools/tts_eval.py --models gemini-3.8,kokoro --judge           # narrower, with IPA judge
python3 -m unittest tests.test_tts_eval                                # checker self-test
```

The key in the session environment is an OpenRouter **management** key. It can list models and create keys but gets `401` on inference, so it cannot run the bake-off.

**Decision rule once it runs.** Pick the cheapest voice that:

1. sounds warm and clear on the talk lines (founder's ear)
2. has a median TTFB under about 1.5 s
3. passes the `/s/` and `/th/` hiss checks on at least some takes, so the bundled model-sound clips can come from the same voice

If no LLM voice passes item 3, generate the model-sound clips with Azure or Polly IPA, or record them, and keep the LLM voice for talk.

**Provisional pick before measurement:** `google/gemini-3.8-flash-tts`. It has the founder's prior success, `instructions` steering, a low price and 30 voices to cast Mibo from. `google/gemini-3.8-flash-lite-tts` is the latency/cost alternate, and Kokoro is the near-free floor.

## 6. Live turn loop (MVP shape)

```text
child speaks -> [device] recogniser -> "tun"            (audio never leaves the device)
app -> Worker {exerciseId, target "sun", heard "tun", attempt 2, ageBand}
Worker -> LLM (JSON schema, ZDR provider routing)
       <- {segments:[{say:"Ooh, close!"},{model:"s_hold"},{say:"sun. Your turn!"}], pose:"encourage"}
Worker validates (allowed model IDs, length <= ~20 words, blocklist) -> TTS for each `say`
app plays segments in order; mouth = audio-driven for `say`, authored pose for `model`
```

Guardrails that carry over to the live loop:

- **Strict JSON schema.** Talk lines are short.
- **The LLM cannot emit a model sound that is not in the library.**
- **Content checks run before TTS.** If anything fails validation or the network is slow, a bundled fallback line plays, so the lesson never stalls or says something unchecked.
- **Provider routing uses OpenRouter `provider.zdr`.** Recognised child text is sensitive even without audio, so only zero-data-retention providers receive it (PROJECT #26).

Latency budget per turn: recogniser end → LLM first token (~0.5 s on a flash-class model) → TTS first byte (measured by the bake-off). Mibo shows a "thinking" pose and can start with a bundled one-word reaction ("Ooh!") to cover the gap.
