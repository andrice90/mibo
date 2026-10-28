"""TTS bake-off: can each voice make Mibo's teaching sounds?

Generates a fixed set of "mouth sound" clips (isolated s/sh/th/f/z hisses,
held vowels, /s/ words, Mibo modelling lines) through every candidate model
on OpenRouter's /api/v1/audio/speech endpoint, then checks each clip with
simple acoustics and builds a listening page that animates Mibo's mouth
from the audio itself.

Why acoustics: the big risk with LLM-style TTS is that "Sssss" comes out
as the letter name "ess" or gets skipped. A real /s/ is a sustained band of
high-frequency noise with no voicing; "ess" is a vowel then a short hiss.
That is cheap to detect, so the report flags it before anyone listens.

Why mouth tracks from audio: no OpenRouter speech model returns word or
phoneme timestamps, so Mibo's 3-4 fps mouth poses are picked from the
audio (silence / vowel by formants / fricative by spectral centroid).
That keeps lip sync vendor-independent.

Needs an OpenRouter *inference* key (a management key gets 401):
    OPENROUTER_LLM_API_KEY=sk-or-v1-... python3 tools/tts_eval.py
    python3 tools/tts_eval.py --models gemini-3.8-flash,kokoro --judge
    python3 tools/tts_eval.py --dry-run
Outputs go to eval/tts/out/ (git-ignored): one WAV per clip, report.json,
and index.html (open it, or serve the folder, to listen).
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import wave
from dataclasses import dataclass
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "eval" / "tts" / "out"
CHARACTER = ROOT / "assets" / "character"
API = "https://openrouter.ai/api/v1"

# Delivery note sent as `instructions`. Gemini, OpenAI and Fish honour it;
# the rest ignore it. Gemini reads `input` verbatim, so directions must
# never go inside the text itself.
MIBO_STYLE = (
    "You are Mibo, a warm, playful cartoon teacher for 4 to 7 year olds. "
    "Speak clearly, a little slowly, smiling. When the text shows a "
    "stretched sound such as 'Sssss' or 'Thhhh', make that actual mouth "
    "sound and hold it for about two seconds. Never say the letter name."
)


@dataclass
class Candidate:
    key: str          # short name used in folders and --models
    model: str        # OpenRouter model id
    voice: str | None
    fmt: str = "pcm"  # pcm or mp3 (Gemini and HeyGen are pcm-only)


CANDIDATES = [
    Candidate("gemini-3.8-flash-puck", "google/gemini-3.8-flash-tts", "Puck"),
    Candidate("gemini-3.8-flash-leda", "google/gemini-3.8-flash-tts", "Leda"),
    Candidate("gemini-3.8-flash-lite-puck", "google/gemini-3.8-flash-lite-tts", "Puck"),
    Candidate("gemini-3.1-flash-preview-puck", "google/gemini-3.1-flash-tts-preview", "Puck"),
    Candidate("kokoro-heart", "hexgrad/kokoro-82m", "af_heart"),
    Candidate("kokoro-sky", "hexgrad/kokoro-82m", "af_sky"),
    Candidate("eleven-flash-v2.5-jessica", "elevenlabs/eleven-flash-v2.5", "jessica"),
    Candidate("eleven-v3-jessica", "elevenlabs/eleven-v3", "jessica"),
    Candidate("mai-voice-2.1-flash-harper", "microsoft/mai-voice-2.1-flash",
              "en-US-Harper:MAI-Voice-2.1-Flash"),
    Candidate("aura-2-thalia", "deepgram/aura-2", "aura-2-thalia-en"),
    Candidate("minimax-2.8-turbo-playful", "minimax/speech-2.8-turbo",
              "English_PlayfulGirl", fmt="mp3"),
    Candidate("orpheus-tara", "canopylabs/orpheus-3b-0.1-ft", "tara"),
    Candidate("grok-voice-eve", "x-ai/grok-voice-tts-1.0", "eve"),
    Candidate("fish-s2.1-pro", "fish-audio/s2.1-pro", None),
]


@dataclass
class Clip:
    id: str
    kind: str          # fricative | vowel | speech
    text: str
    expect: str = ""   # fricative: s/sh/th/f/z, vowel: ah/ee/eh/oh/oo


CLIPS = [
    Clip("iso-s", "fricative", "Sssssss.", "s"),
    Clip("iso-z", "fricative", "Zzzzzzz.", "z"),
    Clip("iso-sh", "fricative", "Shhhhhh.", "sh"),
    Clip("iso-th", "fricative", "Thhhhhh.", "th"),
    Clip("iso-f", "fricative", "Fffffff.", "f"),
    Clip("vowel-ah", "vowel", "Ahhhh.", "ah"),
    Clip("vowel-ee", "vowel", "Eeeee.", "ee"),
    Clip("vowel-oo", "vowel", "Ooooo.", "oo"),
    Clip("vowel-oh", "vowel", "Ohhhh.", "oh"),
    Clip("vowel-eh", "vowel", "Ehhh.", "eh"),
    Clip("syllables-s", "speech", "Sa. See. Soo."),
    Clip("words-s", "speech", "Sun. Sock. Soap. Bus. Mouse."),
    Clip("words-th", "speech", "Thumb. Think. Bath."),
    Clip("model-s", "speech", "Watch my mouth. Sssss... sun! Now your turn."),
    Clip("model-th", "speech",
         "Put your tongue between your teeth. Thhhh... thumb!"),
    Clip("contrast-s", "speech", "Sun. Not tun. Sun!"),
    Clip("live-feedback", "speech",
         "Great try! I heard you keep your teeth together. "
         "Let's do it one more time, nice and slow."),
]


# ---------------------------------------------------------------- synthesis

def post(url: str, key: str, body: dict, timeout: int = 120):
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(), method="POST",
        headers={"Authorization": f"Bearer {key}",
                 "Content-Type": "application/json"})
    return urllib.request.urlopen(req, timeout=timeout)


def synth(c: Candidate, text: str, key: str) -> dict:
    body = {"model": c.model, "input": text, "response_format": c.fmt,
            "instructions": MIBO_STYLE}
    if c.voice:
        body["voice"] = c.voice
    t0 = time.monotonic()
    try:
        with post(f"{API}/audio/speech", key, body) as r:
            first = r.read(1)
            ttfb = time.monotonic() - t0
            data = first + r.read()
            return {"ok": True, "bytes": data, "ttfb": ttfb,
                    "total": time.monotonic() - t0,
                    "content_type": r.headers.get("Content-Type", ""),
                    "gen_id": r.headers.get("X-Generation-Id")}
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": f"{e.code}: {e.read()[:300].decode(errors='replace')}"}
    except Exception as e:  # network, timeout
        return {"ok": False, "error": repr(e)}


def decode(data: bytes, content_type: str, fmt: str) -> tuple[np.ndarray, int]:
    """Return mono float32 samples in [-1, 1] and the sample rate."""
    if fmt == "pcm" and not data[:4] == b"RIFF":
        m = re.search(r"rate=(\d+)", content_type)
        sr = int(m.group(1)) if m else 24000
        pcm = np.frombuffer(data[: len(data) // 2 * 2], dtype="<i2")
        return pcm.astype(np.float32) / 32768.0, sr
    sr = 24000
    p = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", "pipe:0", "-f", "s16le",
         "-ac", "1", "-ar", str(sr), "pipe:1"],
        input=data, capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype="<i2").astype(np.float32) / 32768.0, sr


def write_wav(path: Path, x: np.ndarray, sr: int) -> None:
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def generation_cost(gen_id: str | None, key: str) -> float | None:
    if not gen_id:
        return None
    for _ in range(3):
        try:
            req = urllib.request.Request(
                f"{API}/generation?id={gen_id}",
                headers={"Authorization": f"Bearer {key}"})
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.load(r)["data"].get("total_cost")
        except Exception:
            time.sleep(1.5)
    return None


# ---------------------------------------------------------------- acoustics

HOP = 0.010
WIN = 0.025


def resample(x: np.ndarray, sr: int, target: int) -> np.ndarray:
    if sr == target:
        return x
    n = int(round(len(x) * target / sr))
    spec = np.fft.rfft(x)
    keep = n // 2 + 1
    spec = spec[:keep] if len(spec) >= keep else np.pad(spec, (0, keep - len(spec)))
    return np.fft.irfft(spec, n) * (n / len(x))


def lpc_formants(frame: np.ndarray, sr: int, order: int = 12) -> list[float]:
    """First formants (Hz) from LPC roots; good enough to tell ee/oo/ah."""
    x = np.append(frame[0], frame[1:] - 0.63 * frame[:-1]) * np.hamming(len(frame))
    r = np.correlate(x, x, "full")[len(x) - 1: len(x) + order]
    if r[0] <= 0:
        return []
    a = np.zeros(order + 1)
    a[0] = 1.0
    err = r[0]
    for i in range(1, order + 1):  # Levinson-Durbin
        k = -(r[i] + np.dot(a[1:i], r[i - 1:0:-1])) / err
        a[1:i] = a[1:i] + k * a[i - 1:0:-1]
        a[i] = k
        err *= 1 - k * k
        if err <= 0:
            return []
    roots = [z for z in np.roots(a) if z.imag > 0]
    out = []
    for z in roots:
        f = np.angle(z) * sr / (2 * np.pi)
        bw = -sr / np.pi * np.log(abs(z))
        if 200 < f < 4000 and bw < 400:
            out.append(float(f))
    return sorted(out)


def vowel_from_formants(f: list[float]) -> str:
    if len(f) < 2:
        return "vowel"
    f1, f2 = f[0], f[1]
    if f1 < 420 and f2 > 1900:
        return "ee"
    if f1 < 480 and f2 < 1250:
        return "oo"
    if f1 >= 680:
        return "ah"
    if f2 < 1250:
        return "oh"
    return "eh"


def analyze(x: np.ndarray, sr: int) -> list[dict]:
    """Per-10ms frame features and a coarse class."""
    win, hop = int(WIN * sr), int(HOP * sr)
    x12 = resample(x, sr, 12000)
    w12, h12 = int(WIN * 12000), int(HOP * 12000)
    peak = max(1e-6, float(np.max(np.abs(x))))
    floor = peak * 0.04  # about -28 dB re peak
    freqs = np.fft.rfftfreq(win, 1 / sr)
    hf = freqs >= 3500
    lag_lo, lag_hi = int(sr / 400), int(sr / 75)
    frames = []
    for i, start in enumerate(range(0, max(1, len(x) - win), hop)):
        f = x[start:start + win]
        rms = float(np.sqrt(np.mean(f * f)))
        feat = {"t": round(i * HOP, 3), "rms": rms, "cls": "silence"}
        if rms < floor:
            frames.append(feat)
            continue
        spec = np.abs(np.fft.rfft(f * np.hanning(len(f)))) ** 2
        total = float(spec.sum()) or 1e-12
        feat["hf"] = float(spec[hf].sum() / total)
        feat["centroid"] = float((freqs * spec).sum() / total)
        fc = f - f.mean()
        ac = np.correlate(fc, fc, "full")[len(fc) - 1:]
        voicing = float(ac[lag_lo:lag_hi].max() / ac[0]) if ac[0] > 0 else 0.0
        feat["voicing"] = voicing
        if voicing > 0.45 and feat["hf"] < 0.35:
            seg = x12[i * h12: i * h12 + w12]
            feat["formants"] = lpc_formants(seg, 12000)[:3] if len(seg) == w12 else []
            feat["cls"] = vowel_from_formants(feat["formants"])
        elif feat["hf"] >= 0.35:
            # Fricative place from centroid: /s,z/ highest, /sh/ mid, /f,th/
            # flat and weak (their centroid wanders, so they share a class).
            c = feat["centroid"]
            feat["cls"] = "fric_s" if c > 5200 else "fric_sh" if c > 3000 else "fric_flat"
        else:
            feat["cls"] = "voiced_other" if voicing > 0.45 else "noise_other"
        frames.append(feat)
    return frames


VOWELS = {"ah", "ee", "eh", "oh", "oo", "vowel"}


def longest_run(frames: list[dict], pred) -> float:
    best = cur = 0
    for f in frames:
        cur = cur + 1 if pred(f) else 0
        best = max(best, cur)
    return round(best * HOP, 2)


def check(clip: Clip, frames: list[dict]) -> dict:
    sound = [f for f in frames if f["cls"] != "silence"]
    voiced_s = sum(HOP for f in sound)
    res = {"sounding_s": round(voiced_s, 2)}
    if not sound:
        return {**res, "pass": False, "why": "no audio above the noise floor"}
    if clip.kind == "fricative":
        is_fric = lambda f: f["cls"].startswith("fric")  # noqa: E731
        run = longest_run(frames, is_fric)
        vowel_frac = sum(f["cls"] in VOWELS for f in sound) / len(sound)
        fric = [f for f in sound if is_fric(f)]
        cent = float(np.median([f["centroid"] for f in fric])) if fric else 0.0
        res.update(fric_run_s=run, vowel_frac=round(vowel_frac, 2),
                   centroid_hz=round(cent))
        place_ok = {"s": cent > 5200, "z": cent > 4500, "sh": 2500 < cent <= 5200,
                    "th": True, "f": True}[clip.expect]
        ok = run >= 0.5 and vowel_frac < 0.3 and place_ok
        why = []
        if run < 0.5:
            why.append(f"hiss held only {run}s")
        if vowel_frac >= 0.3:
            why.append(f"{int(vowel_frac * 100)}% vowel: likely said a letter name")
        if not place_ok:
            why.append(f"hiss centred at {round(cent)} Hz, wrong place for /{clip.expect}/")
        return {**res, "pass": ok, "why": "; ".join(why) or "sustained hiss"}
    if clip.kind == "vowel":
        run = longest_run(frames, lambda f: f["cls"] in VOWELS)
        labels = [f["cls"] for f in sound if f["cls"] in VOWELS - {"vowel"}]
        top = max(set(labels), key=labels.count) if labels else "?"
        res.update(vowel_run_s=run, heard_vowel=top)
        ok = run >= 0.4
        return {**res, "pass": ok, "vowel_match": top == clip.expect,
                "why": f"held {run}s, formants suggest '{top}'"}
    return {**res, "pass": True, "why": "listen"}


# Pose names match assets/character/poses.json. Consonant poses do not exist
# yet, so fricatives borrow the nearest vowel mouth: /s/ teeth-together
# smile -> ee, /sh/ pucker -> oo, /f, th/ -> eh (half open, tongue visible).
POSE = {"silence": "rest", "ah": "ah", "ee": "ee", "eh": "eh", "oh": "oh",
        "oo": "oo", "vowel": "eh", "fric_s": "ee", "fric_sh": "oo",
        "fric_flat": "eh", "voiced_other": "eh", "noise_other": "rest"}


def mouth_track(frames: list[dict], fps: float = 4.0) -> list[dict]:
    """Majority frame class per 1/fps window -> sprite pose."""
    step = int(round(1 / fps / HOP))
    track = []
    for i in range(0, len(frames), step):
        window = [f["cls"] for f in frames[i:i + step]]
        sounding = [c for c in window if c != "silence"]
        if len(sounding) < len(window) * 0.3:
            cls = "silence"
        else:
            cls = max(set(sounding), key=sounding.count)
        track.append({"t": round(i * HOP, 2), "cls": cls, "pose": POSE[cls]})
    return track


# ---------------------------------------------------------------- judge

JUDGE_PROMPT = (
    "You are a speech-language phonetics checker. Transcribe exactly what is "
    "heard in this audio in narrow IPA, without normalising to dictionary "
    "words (if a hiss is held, write [sːːː]; if the letter name is said, "
    "write [ɛs]). Then answer in JSON: {\"ipa\": ..., \"target_sound_clear\": "
    "true|false, \"notes\": short}. Intended text: "
)


def judge(model: str, key: str, wav: bytes, text: str) -> dict:
    body = {"model": model, "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "user", "content": [
                {"type": "text", "text": JUDGE_PROMPT + json.dumps(text)},
                {"type": "input_audio", "input_audio": {
                    "data": base64.b64encode(wav).decode(), "format": "wav"}}]}]}
    try:
        with post(f"{API}/chat/completions", key, body, timeout=90) as r:
            content = json.load(r)["choices"][0]["message"]["content"]
        m = re.search(r"\{.*\}", content, re.S)
        return json.loads(m.group(0)) if m else {"raw": content}
    except Exception as e:
        return {"error": repr(e)[:300]}


# ---------------------------------------------------------------- report

def run(args) -> int:
    cands = [c for c in CANDIDATES
             if not args.models or any(m in c.key for m in args.models.split(","))]
    clips = [c for c in CLIPS
             if not args.clips or any(m in c.id for m in args.clips.split(","))]
    chars = sum(len(c.text) for c in clips)
    print(f"{len(cands)} candidates x {len(clips)} clips ({chars} chars each)")
    if args.dry_run:
        for c in cands:
            print(f"  {c.key:32s} {c.model}  voice={c.voice}  fmt={c.fmt}")
        return 0
    key = (os.environ.get("OPENROUTER_TTS_KEY") or os.environ.get("OPENROUTER_LLM_API_KEY")
           or os.environ.get("OPENROUTER_API_KEY"))
    if not key:
        print("Set OPENROUTER_LLM_API_KEY (or OPENROUTER_TTS_KEY) to an OpenRouter inference key.", file=sys.stderr)
        return 2

    OUT.mkdir(parents=True, exist_ok=True)
    shutil.copytree(CHARACTER, OUT / "character", dirs_exist_ok=True)
    report = {"clips": [c.__dict__ for c in clips], "style": MIBO_STYLE,
              "candidates": []}
    for cand in cands:
        print(f"\n== {cand.key}")
        cdir = OUT / cand.key
        cdir.mkdir(exist_ok=True)
        entry = {**cand.__dict__, "results": {}}
        for clip in clips:
            r = synth(cand, clip.text, key)
            if not r["ok"]:
                print(f"  {clip.id:14s} ERROR {r['error'][:120]}")
                entry["results"][clip.id] = {"error": r["error"]}
                if r["error"].startswith(("400", "401", "402", "404")) and clip is clips[0]:
                    break  # model unusable as configured; skip the rest
                continue
            x, sr = decode(r["bytes"], r["content_type"], cand.fmt)
            wav_path = cdir / f"{clip.id}.wav"
            write_wav(wav_path, x, sr)
            frames = analyze(x, sr)
            res = {"file": f"{cand.key}/{clip.id}.wav",
                   "duration_s": round(len(x) / sr, 2),
                   "ttfb_s": round(r["ttfb"], 2), "total_s": round(r["total"], 2),
                   "cost_usd": generation_cost(r["gen_id"], key),
                   **check(clip, frames), "track": mouth_track(frames)}
            if args.judge:
                res["judge"] = judge(args.judge_model, key, wav_path.read_bytes(), clip.text)
            entry["results"][clip.id] = res
            mark = "PASS" if res["pass"] else "FLAG"
            print(f"  {clip.id:14s} {mark} {res['duration_s']:5.2f}s "
                  f"ttfb {res['ttfb_s']:.2f}s  {res['why']}")
        ok = [v for v in entry["results"].values() if "pass" in v]
        entry["fricative_pass"] = sum(
            v["pass"] for k, v in entry["results"].items() if k.startswith("iso-") and "pass" in v)
        entry["median_ttfb_s"] = round(float(np.median([v["ttfb_s"] for v in ok])), 2) if ok else None
        costs = [v["cost_usd"] for v in ok if v.get("cost_usd") is not None]
        entry["cost_usd"] = round(sum(costs), 5) if costs else None
        report["candidates"].append(entry)
        (OUT / "report.json").write_text(json.dumps(report, indent=1))
    html = (ROOT / "eval" / "tts" / "listen.html").read_text()
    (OUT / "index.html").write_text(
        html.replace("/*REPORT*/null", json.dumps(report, separators=(",", ":"))))
    print(f"\nWrote {OUT / 'report.json'} and {OUT / 'index.html'}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--models", help="comma list of candidate key substrings")
    p.add_argument("--clips", help="comma list of clip id substrings")
    p.add_argument("--judge", action="store_true",
                   help="also ask an audio LLM for an IPA transcription")
    p.add_argument("--judge-model", default="google/gemini-3.5-flash")
    p.add_argument("--dry-run", action="store_true")
    return run(p.parse_args())


if __name__ == "__main__":
    sys.exit(main())
