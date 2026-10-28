# 06 — Live voice pivot & TTS discovery

Status: Draft, 2026-10-28. Records the founder's pivot (PROJECT #45) and the TTS discovery that gates the MVP build. Pricing is from OpenRouter's live model list on 2026-10-28. First bake-off results are in §5 (run 2026-10-28). Warmth on the talk lines still needs the founder's ear.

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

## 5. Bake-off harness and first results

`tools/tts_eval.py` sends 17 clips through 14 candidate voices:

- isolated `s, z, sh, th, f`
- held `ah, ee, oo, oh, eh`
- `/s/` and `/th/` words
- Mibo modelling lines
- a minimal pair, and a "live feedback" line

For each clip it records time-to-first-byte (live latency), duration, real cost (from the generation record, looked up after synthesis because the record lags the audio by several seconds) and the acoustic verdict. The acoustic check flags *letter name instead of hiss*, *hiss too short* and *wrong place, e.g. /sh/ instead of /s/*. Vowels get a formant guess. An optional `--judge` pass asks an audio-input LLM for a narrow IPA transcription. It writes `eval/tts/out/index.html`, a listening page where every clip plays with **Mibo's mouth animated from that clip's audio**, so we judge sound and sync together.

```sh
OPENROUTER_LLM_API_KEY=sk-or-v1-... python3 tools/tts_eval.py            # all 14 candidates, ~$0.25 of TTS
python3 tools/tts_eval.py --models gemini-3.8,kokoro --judge           # narrower, with IPA judge
python3 -m unittest tests.test_tts_eval                                # checker self-test
```

### 5.1 Results, 2026-10-28 (one take per clip, `--judge`)

TTFB is the median over the clips, with 4 candidates running in parallel. $/min is the measured cost divided by the measured audio length. Hiss columns are the acoustic check: **P** = sustained hiss in the right place, **–** = flagged.

| Voice | TTFB | $/min | /s/ | /z/ | /sh/ | /th/ | /f/ | Held vowels | Notes |
|---|---|---|---|---|---|---|---|---|---|
| eleven-flash-v2.5 · jessica | **0.44 s** | 0.034 | P | – | – | – | – | 3/5 | /th/ came out as [aː] |
| aura-2 · thalia | 0.48 s | 0.021 | – | – | – | – | – | 0/5 | "ess" + short hiss |
| grok-voice-tts-1.0 · eve | 0.49 s | 0.008 | P | – | P | – | – | 5/5 | /th/ came out as [tʰh] |
| minimax-2.8-turbo · playful | 0.51 s | 0.015 | – | – | – | – | – | 4/5 | /s/ read as [ɛs ɛs ɛs…] |
| orpheus-3b · tara | 0.58 s | 0.003 | – | – | P | – | – | 5/5 | Real /s/ and /θ/, held only ~0.3 s |
| mai-voice-2.1-flash · harper | 0.59 s | 0.004 | P | P | – | – | – | 4/5 | /th/ came out as [fuː] |
| kokoro-82m · sky | 0.86 s | 0.0003 | – | – | – | – | – | 4/5 | /s/ read as [ɛs]×7 |
| kokoro-82m · heart | 1.06 s | 0.0004 | – | – | – | – | – | 0/5 | "ess-ess-ess" |
| eleven-v3 · jessica | 1.64 s | 0.034 | P | – | – | **P** | – | 4/5 | Only voice with a clean isolated /θ/ |
| gemini-3.1-flash-preview · puck | 1.88 s | 0.046 | P | – | – | – | P | 3/5 | /th/ came out as [tʰa] |
| gemini-3.8-flash-lite · puck | 2.25 s | 0.003 | P | P | – | – | P | 4/5 | /th/ voiced [ðː]; said "shun" for *sun* in a line |
| gemini-3.8-flash · puck | 2.44 s | 0.010 | P | P | P | – | – | 4/5 | /th/ came out as [f] |
| gemini-3.8-flash · leda | 2.61 s | 0.012 | P | – | P | – | P | 5/5 | /th/ came out as [f] |
| fish-s2.1-pro | 0.68 s | 0.059 | – | – | – | n/a | n/a | 1/5 | Run hit the account's credit limit; 9 clips missing |

What this shows:

1. **No voice makes every teaching sound from bare text.** /s/ is fine on 8 of 14 voices. An isolated /θ/ works on only one (eleven-v3). The usual failures are the letter name ("ess", "tee-aitch"), /θ/ becoming [f], [ð] or [t], and a hiss that is real but under half a second.
2. **Context helps /θ/.** Inside the modelling line "Thhhh... thumb!", most voices did produce a held [θːː], per the judge. So bundled model-sound clips should be generated as short phrases and trimmed, not from a bare "Thhhh."
3. **Gemini is too slow for the live turn.** Every Gemini tier had a median TTFB of 1.9–2.6 s, against a 1.5 s budget. The provisional Gemini pick does not hold for talk segments.
4. **Fast and cheap voices that hold /s/:** grok-voice eve (0.49 s, ~$0.008/min) and MAI Harper (0.59 s, ~$0.004/min). ElevenLabs Flash is the fastest but about 4× the price.
5. **The LLM judge leans toward the intended text.** It wrote [sːːː] for Kokoro and Aura clips that are audibly "ess", because the prompt tells it what the text should be. Its "not clear" verdicts are useful, for example catching /θ/→[f], which the acoustic check cannot tell apart. Its "clear" verdicts are not reliable. It also cost about $6.50 for the 230 clips (~3¢ each), roughly 30× the TTS spend. Before trusting it, run it blind, without the intended text in the prompt.

**Revised recommendation (pending the founder's listen):**

- **Talk segments:** `x-ai/grok-voice-tts-1.0` (eve) or `microsoft/mai-voice-2.1-flash` (Harper), whichever sounds warmer. Both are well inside the latency budget at under 1¢ per minute.
- **Model-sound segments:** generate offline in the chosen voice, as phrase takes with several retries, and keep the ones that pass both the acoustic check and the ear. If the chosen voice cannot produce /θ/ even in context, use `elevenlabs/eleven-v3` for that clip only, or Azure/Polly IPA, or a recording.
- Gemini Flash stays an option for offline model-sound clips: good /s/, cheap, and latency doesn't matter there.

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
