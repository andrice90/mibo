"""Acoustic checks in tools/tts_eval.py on synthetic sounds.

A held /s/ is high-band noise with no voicing; the letter name "ess" puts a
vowel in front of a short hiss. The checker must tell them apart, and the
formant guess must separate ee/oo/ah. Run from the repo root:
    python3 -m unittest tests.test_tts_eval
"""
import importlib.util
import sys
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("tts_eval", ROOT / "tools" / "tts_eval.py")
mod = importlib.util.module_from_spec(spec)
sys.modules["tts_eval"] = mod  # dataclasses resolve annotations via sys.modules
spec.loader.exec_module(mod)

SR = 24000
rng = np.random.default_rng(0)


def hiss(seconds, lo, hi):
    n = int(seconds * SR)
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    spec[(f < lo) | (f > hi)] = 0
    x = np.fft.irfft(spec, n)
    return 0.3 * x / np.abs(x).max()


def vowel(seconds, f1, f2, f0=180.0):
    t = np.arange(int(seconds * SR)) / SR
    x = np.zeros_like(t)
    for k in range(1, int(4000 / f0)):
        h = k * f0
        amp = sum(1 / (1 + ((h - fc) / 90) ** 2) for fc in (f1, f2, 2900)) / k ** 0.5
        x += amp * np.sin(2 * np.pi * h * t)
    return 0.5 * x / np.abs(x).max()


def silence(seconds):
    return np.zeros(int(seconds * SR))


S_CLIP = mod.Clip("iso-s", "fricative", "Sssss.", "s")


class FricativeCheckTest(unittest.TestCase):
    def test_held_s_passes(self):
        x = np.concatenate([silence(0.2), hiss(1.2, 5500, 11000), silence(0.2)])
        res = mod.check(S_CLIP, mod.analyze(x, SR))
        self.assertTrue(res["pass"], res)
        self.assertGreater(res["centroid_hz"], 5200)

    def test_letter_name_ess_is_flagged(self):
        x = np.concatenate([silence(0.2), vowel(0.35, 580, 1800),
                            hiss(0.2, 5500, 11000), silence(0.2)])
        res = mod.check(S_CLIP, mod.analyze(x, SR))
        self.assertFalse(res["pass"], res)

    def test_sh_is_not_accepted_as_s(self):
        x = np.concatenate([silence(0.2), hiss(1.2, 2200, 4500), silence(0.2)])
        res = mod.check(S_CLIP, mod.analyze(x, SR))
        self.assertFalse(res["pass"], res)


class VowelTest(unittest.TestCase):
    def heard(self, f1, f2):
        x = np.concatenate([silence(0.2), vowel(0.8, f1, f2), silence(0.2)])
        clip = mod.Clip("v", "vowel", "", "")
        return mod.check(clip, mod.analyze(x, SR))["heard_vowel"]

    def test_formant_guesses(self):
        self.assertEqual(self.heard(300, 2300), "ee")
        self.assertEqual(self.heard(320, 870), "oo")
        self.assertEqual(self.heard(750, 1200), "ah")


class MouthTrackTest(unittest.TestCase):
    def test_four_fps_track_poses(self):
        x = np.concatenate([silence(0.5), vowel(0.5, 750, 1200), hiss(0.5, 5500, 11000)])
        track = mod.mouth_track(mod.analyze(x, SR))
        poses = [p["pose"] for p in track]
        self.assertEqual(poses[0], "rest")
        self.assertIn("ah", poses)
        self.assertEqual(poses[-1], "ee")  # /s/ borrows the teeth-together mouth


if __name__ == "__main__":
    unittest.main()
