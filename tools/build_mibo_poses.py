"""Extract Mibo from assets/mibo-wave.gif and build 2D vowel poses.

Run from the repo root:
    .venv\\Scripts\\python.exe tools\\build_mibo_poses.py

Outputs transparent PNGs in assets/character/ plus a preview sheet and
poses.json. The GIF's peach background (255, 235, 218) is removed by
flood fill from the frame edges, so enclosed colours (cheeks, highlights)
survive. Mouth shapes are drawn over the original smile as chunky
teaching mouths. Body poses come from separate GIF frames, so animation
is pose rotation at 6-8 fps with holds, not smooth tweening.
"""
from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "mibo-wave.gif"
OUT = ROOT / "assets" / "character"

BG = (255, 235, 218)
BODY = (118, 255, 194)
OUTLINE = (10, 10, 10)
MOUTH_IN = (74, 24, 32)
TONGUE = (255, 138, 168)
TEETH = (255, 255, 255)
LINE = 12

# Mouth centre in the 1024x1024 source frame (found by pixel scan + zoom)
MX, MY = 512, 542

# Upscale factor for the raster base: the GIF is soft 1024px raster while
# the drawn mouths are crisp vector, so the base is denoised, upscaled 3x
# with Lanczos and sharpened before any mouth is drawn on it.
SCALE = 3


def cutout(rgb: Image.Image) -> Image.Image:
    """Flood-fill the peach background from the edges to transparent."""
    w, h = rgb.size
    px = rgb.load()
    seen = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i]:
            continue
        r, g, b = px[x, y]
        if (r - BG[0]) ** 2 + (g - BG[1]) ** 2 + (b - BG[2]) ** 2 >= 2600:
            continue
        seen[i] = 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                q.append((nx, ny))
    im = rgb.convert("RGBA")
    op = im.load()
    for y in range(h):
        for x in range(w):
            if seen[y * w + x]:
                op[x, y] = (255, 255, 255, 0)
    return im


def upscale(im: Image.Image) -> Image.Image:
    """Denoise, upscale and sharpen the raster base to match the mouths."""
    w, h = im.size
    im = im.resize((w * SCALE, h * SCALE), Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=2.2, percent=88, threshold=2))
    return im


def draw_mouth(im: Image.Image, kind: str) -> Image.Image:
    d = ImageDraw.Draw(im)
    s = SCALE
    cx, cy = MX * s, MY * s
    lw = LINE * s
    # erase the original smile (wide, tall, flat body fill)
    d.ellipse([cx - 96 * s, cy - 58 * s, cx + 96 * s, cy + 48 * s], fill=BODY)
    cy = cy + 20 * s  # open mouths hang below the smile line
    if kind == "rest":
        d.arc([cx - 46 * s, cy - 50 * s, cx + 46 * s, cy + 14 * s], 15, 165, fill=OUTLINE, width=lw)
    elif kind == "ah":  # big open oval + tongue
        d.ellipse([cx - 64 * s, cy - 72 * s, cx + 64 * s, cy + 82 * s], fill=MOUTH_IN, outline=OUTLINE, width=lw)
        d.ellipse([cx - 42 * s, cy + 28 * s, cx + 42 * s, cy + 76 * s], fill=TONGUE)
    elif kind == "ee":  # wide grin, teeth
        d.rounded_rectangle([cx - 88 * s, cy - 36 * s, cx + 88 * s, cy + 38 * s], radius=30 * s,
                            fill=TEETH, outline=OUTLINE, width=lw)
        d.line([cx - 80 * s, cy + 1 * s, cx + 80 * s, cy + 1 * s], fill=OUTLINE, width=6 * s)
    elif kind == "eh":  # relaxed half-open
        d.ellipse([cx - 70 * s, cy - 38 * s, cx + 70 * s, cy + 52 * s], fill=MOUTH_IN, outline=OUTLINE, width=lw)
        d.ellipse([cx - 44 * s, cy + 14 * s, cx + 44 * s, cy + 46 * s], fill=TONGUE)
    elif kind == "oh":  # round O
        d.ellipse([cx - 52 * s, cy - 54 * s, cx + 52 * s, cy + 54 * s], fill=MOUTH_IN, outline=OUTLINE, width=lw)
        d.ellipse([cx - 28 * s, cy + 10 * s, cx + 28 * s, cy + 44 * s], fill=TONGUE)
    elif kind == "oo":  # small puckered circle
        d.ellipse([cx - 32 * s, cy - 32 * s, cx + 32 * s, cy + 32 * s], fill=MOUTH_IN, outline=OUTLINE, width=lw)
    else:
        raise ValueError(kind)
    return im


def make(gif: Image.Image, frame_idx: int, mouth: str) -> Image.Image:
    gif.seek(frame_idx)
    rgb = gif.convert("RGB").filter(ImageFilter.MedianFilter(size=3))
    im = upscale(cutout(rgb))
    im = draw_mouth(im, mouth)
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    gif = Image.open(SRC)
    outputs = {
        "mibo-idle.png": make(gif, 0, "rest"),
        "mibo-wave.png": make(gif, 8, "rest"),
        "mibo-celebrate.png": make(gif, 17, "rest"),
        "mibo-vowel-ah.png": make(gif, 0, "ah"),
        "mibo-vowel-ee.png": make(gif, 0, "ee"),
        "mibo-vowel-eh.png": make(gif, 0, "eh"),
        "mibo-vowel-oh.png": make(gif, 0, "oh"),
        "mibo-vowel-oo.png": make(gif, 0, "oo"),
        "mibo-vowel-rest.png": make(gif, 0, "rest"),
    }
    for name, im in outputs.items():
        im.save(OUT / name)
        print(name, im.size)

    cell = 340
    sheet = Image.new("RGB", (cell * 3, cell * 3), (250, 244, 238))
    for i, name in enumerate(outputs):
        t = outputs[name].copy()
        t.thumbnail((cell - 16, cell - 16))
        sheet.paste(t, ((i % 3) * cell + 8, (i // 3) * cell + 8), t)
    sheet.save(OUT / "preview-sheet.png")

    manifest = {
        "style": "2D sprite poses, rotate at 6-8 fps with holds (no tweening)",
        "source": "assets/mibo-wave.gif frames 0 (idle), 8 (wave), 17 (celebrate)",
        "poses": {
            "idle": "mibo-idle.png",
            "wave": "mibo-wave.png",
            "celebrate": "mibo-celebrate.png",
        },
        "vowels_on_idle_body": {
            "rest_closed": "mibo-vowel-rest.png",
            "ah": "mibo-vowel-ah.png",
            "ee": "mibo-vowel-ee.png",
            "eh": "mibo-vowel-eh.png",
            "oh": "mibo-vowel-oh.png",
            "oo": "mibo-vowel-oo.png",
        },
        "notes": [
            "Mouth shapes are drawn teaching mouths, larger than the source smile.",
            "Swap the whole pose per phoneme; hold each pose, do not interpolate.",
            "Wave/celebrate keep the rest mouth; add vowel variants per body pose only when a lesson needs them.",
        ],
    }
    (OUT / "poses.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
