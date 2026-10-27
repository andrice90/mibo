"""Regression test: each body pose frame needs its own mouth centre.

The celebrate frame (GIF frame 17) is vertically squished, so its face
sits lower than the idle frame. Sharing the idle mouth centre put the
erase ellipse over the eyes. Run from the repo root:
    .venv\\Scripts\\python.exe -m unittest tests.test_mibo_poses
"""
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location(
    "build_mibo_poses", ROOT / "tools" / "build_mibo_poses.py"
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class MouthCentreTest(unittest.TestCase):
    def test_celebrate_mouth_is_lower_than_idle(self):
        self.assertIn(17, mod.MOUTH_BY_FRAME)
        idle_y = mod.MOUTH_BY_FRAME[0][1]
        celebrate_y = mod.MOUTH_BY_FRAME[17][1]
        self.assertGreaterEqual(celebrate_y - idle_y, 24)

    def test_every_used_frame_has_a_centre(self):
        for frame in (0, 8, 13, 14, 15, 16, 17):
            self.assertIn(frame, mod.MOUTH_BY_FRAME)
            x, y = mod.MOUTH_BY_FRAME[frame]
            self.assertTrue(0 < x < 1024 and 0 < y < 1024)


if __name__ == "__main__":
    unittest.main()
