"""Extract Mibo from assets/mibo-wave.gif and build 2D vowel poses.

Run from the repo root:
    .venv\\Scripts\\python.exe tools\\build_mibo_poses.py

Outputs transparent PNGs in assets/character/ plus a preview sheet and
poses.json. The GIF's peach background (255, 235, 218) is removed by
flood fill from the frame edges, so enclosed colours (cheeks, highlights)
survive. Mouth shapes are drawn over the original smile as chunky
teaching mouths. Body poses come from separate GIF frames, so animation
is pose rotation at 3-4 fps with holds, not smooth tweening.
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

# Mouth centres per source frame, in 1024x1024 frame coords (pixel scan).
# Frames are not interchangeable: frame 17 (celebrate) is squished, so its
# face and mouth sit lower. Sharing one centre put the erase over its eyes.
MOUTH_BY_FRAME = {
    0: (512, 542),   # idle
    8: (512, 538),   # wave
    13: (518, 546),  # idle rotation frames (face a touch right/lower)
    14: (518, 546),
    15: (518, 546),
    16: (518, 546),
    17: (512, 574),  # celebrate (squished, mouth lower)
}

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


def draw_mouth(im: Image.Image, kind: str, centre: tuple[int, int], stage: float = 1.0) -> Image.Image:
    """Draw a mouth. stage < 1 gives the lead-in/lead-out transition
    frames between rest and the full vowel shape."""
    d = ImageDraw.Draw(im)
    s = SCALE
    cx, cy = centre[0] * s, centre[1] * s
    lw = LINE * s
    m = stage
    # erase the original smile; kept tight so it never reaches the eyes
    d.ellipse([cx - 96 * s, cy - 52 * s, cx + 96 * s, cy + 40 * s], fill=BODY)
    cy = cy + 20 * s  # open mouths hang below the smile line
    if kind == "rest":
        d.arc([cx - 46 * s, cy - 50 * s, cx + 46 * s, cy + 14 * s], 15, 165, fill=OUTLINE, width=lw)
    elif kind == "ah":  # big open oval + tongue
        d.ellipse([cx - 64 * s * m, cy - 72 * s * m, cx + 64 * s * m, cy + 82 * s * m], fill=MOUTH_IN, outline=OUTLINE, width=lw)
        d.ellipse([cx - 42 * s * m, cy + 28 * s * m, cx + 42 * s * m, cy + 76 * s * m], fill=TONGUE)
    elif kind == "ee":  # wide grin, teeth
        d.rounded_rectangle([cx - 88 * s * m, cy - 36 * s * m, cx + 88 * s * m, cy + 38 * s * m], radius=30 * s * m,
                            fill=TEETH, outline=OUTLINE, width=lw)
        d.line([cx - 80 * s * m, cy + 1 * s, cx + 80 * s * m, cy + 1 * s], fill=OUTLINE, width=6 * s)
    elif kind == "eh":  # relaxed half-open
        d.ellipse([cx - 70 * s * m, cy - 38 * s * m, cx + 70 * s * m, cy + 52 * s * m], fill=MOUTH_IN, outline=OUTLINE, width=lw)
        d.ellipse([cx - 44 * s * m, cy + 14 * s * m, cx + 44 * s * m, cy + 46 * s * m], fill=TONGUE)
    elif kind == "oh":  # round O
        d.ellipse([cx - 52 * s * m, cy - 54 * s * m, cx + 52 * s * m, cy + 54 * s * m], fill=MOUTH_IN, outline=OUTLINE, width=lw)
        d.ellipse([cx - 28 * s * m, cy + 10 * s * m, cx + 28 * s * m, cy + 44 * s * m], fill=TONGUE)
    elif kind == "oo":  # small puckered circle
        d.ellipse([cx - 32 * s * m, cy - 32 * s * m, cx + 32 * s * m, cy + 32 * s * m], fill=MOUTH_IN, outline=OUTLINE, width=lw)
    else:
        raise ValueError(kind)
    return im


BALL_COLOURS = [(232, 84, 84), (250, 199, 82), (92, 156, 232)]


def draw_prop(im: Image.Image, prop: str, step: int) -> Image.Image:
    """Fun props drawn in source-frame coords (x, y, r), scaled."""
    d = ImageDraw.Draw(im)
    s = SCALE

    def ball(cx, cy, r, fill):
        d.ellipse([(cx - r) * s, (cy - r) * s, (cx + r) * s, (cy + r) * s],
                  fill=fill, outline=OUTLINE, width=max(6, 8 * s // 3))

    if prop == "basketball":
        # 3-step bounce loop beside the right arm; seams clipped to ball
        pos = [(792, 736), (806, 556), (792, 720)][step]
        layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        cx, cy = pos[0] * s, pos[1] * s
        r = 100 * s
        ld.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(244, 132, 46, 255),
                   outline=OUTLINE, width=8 * s // 3)
        ld.line([cx - r, cy, cx + r, cy], fill=OUTLINE, width=7 * s // 3)
        ld.line([cx, cy - r, cx, cy + r], fill=OUTLINE, width=7 * s // 3)
        ld.arc([cx - r, cy - r // 2, cx + r, cy + r // 2], 0, 360, fill=OUTLINE, width=7 * s // 3)
        mask = Image.new("L", im.size, 0)
        ImageDraw.Draw(mask).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
        im.paste(Image.alpha_composite(im, layer), (0, 0), mask)
        # redraw outline on top of the clipped seams
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=OUTLINE, width=8 * s // 3)
    elif prop == "juggling":
        # 3 frames: balls cycle through left / top / right arc positions
        spots = [(318, 206), (512, 92), (706, 206)]
        for i, (x, y) in enumerate(spots):
            ball(x, y, 50, BALL_COLOURS[(i + step) % 3])
    else:
        raise ValueError(prop)
    return im


def make(gif: Image.Image, frame_idx: int, mouth: str, stage: float = 1.0,
         prop: str | None = None, prop_step: int = 0) -> Image.Image:
    gif.seek(frame_idx)
    rgb = gif.convert("RGB").filter(ImageFilter.MedianFilter(size=3))
    im = upscale(cutout(rgb))
    im = draw_mouth(im, mouth, MOUTH_BY_FRAME[frame_idx], stage)
    if prop:
        im = draw_prop(im, prop, prop_step)
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
    # idle rotation: subtle body shifts from the GIF's neutral frames
    for n, frame in enumerate((0, 14, 15, 16), start=1):
        outputs[f"mibo-idle-{n}.png"] = make(gif, frame, "rest")
    # vowel transitions: sequence per vowel is
    # rest -> t1 (40% open) -> t2 (70% open) -> full -> t2 -> t1 -> rest
    for vowel in ("ah", "ee", "eh", "oh", "oo"):
        outputs[f"mibo-anim-{vowel}-t1.png"] = make(gif, 0, vowel, stage=0.4)
        outputs[f"mibo-anim-{vowel}-t2.png"] = make(gif, 0, vowel, stage=0.7)
    # fun loops (rest mouth, props carry the motion)
    for step in range(3):
        outputs[f"mibo-fun-basketball-{step + 1}.png"] = make(
            gif, 0, "rest", prop="basketball", prop_step=step)
        outputs[f"mibo-fun-juggling-{step + 1}.png"] = make(
            gif, 0, "rest", prop="juggling", prop_step=step)
    # Normalise to one canvas (bottom-centred) so pose rotation at
    # 3-4 fps does not jump as cropped widths differ per GIF frame.
    max_w = max(im.width for im in outputs.values())
    max_h = max(im.height for im in outputs.values())
    for name, im in list(outputs.items()):
        canvas = Image.new("RGBA", (max_w, max_h), (255, 255, 255, 0))
        canvas.paste(im, ((max_w - im.width) // 2, max_h - im.height), im)
        outputs[name] = canvas
    # Deliver at app size: mouths were drawn at 3x, so downscaling keeps
    # them crisp while keeping each PNG well under 1 MB.
    for name, im in list(outputs.items()):
        if im.width > 1400:
            outputs[name] = im.resize(
                (1400, round(im.height * 1400 / im.width)), Image.LANCZOS)
    for name, im in outputs.items():
        im.save(OUT / name, optimize=True)
        print(name, im.size)

    def sheet(names, filename, cols=3):
        rows = (len(names) + cols - 1) // cols
        cell = 340
        page = Image.new("RGB", (cell * cols, cell * rows), (250, 244, 238))
        for i, name in enumerate(names):
            t = outputs[name].copy()
            t.thumbnail((cell - 16, cell - 16))
            page.paste(t, ((i % cols) * cell + 8, (i // cols) * cell + 8), t)
        page.save(OUT / filename)

    sheet(list(outputs)[:9], "preview-sheet.png")
    sheet([n for n in outputs if "anim" in n or "idle-" in n], "preview-transitions.png", cols=4)
    sheet([n for n in outputs if "fun" in n], "preview-fun.png")

    manifest = {
        "style": "2D sprite poses, rotate at 3-4 fps with holds (no tweening)",
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
        "idle_rotation": [f"mibo-idle-{n}.png" for n in range(1, 5)],
        "vowel_transitions": {
            v: {
                "sequence_at_3_to_4_fps": [
                    "mibo-vowel-rest.png",
                    f"mibo-anim-{v}-t1.png",
                    f"mibo-anim-{v}-t2.png",
                    f"mibo-vowel-{v}.png",
                    f"mibo-anim-{v}-t2.png",
                    f"mibo-anim-{v}-t1.png",
                    "mibo-vowel-rest.png",
                ],
                "t1": "40 percent open",
                "t2": "70 percent open",
            }
            for v in ("ah", "ee", "eh", "oh", "oo")
        },
        "fun_loops": {
            "basketball_bounce_3_frames": [f"mibo-fun-basketball-{n}.png" for n in range(1, 4)],
            "juggling_3_frames": [f"mibo-fun-juggling-{n}.png" for n in range(1, 4)],
        },
        "notes": [
            "Mouth shapes are drawn teaching mouths, larger than the source smile.",
            "Swap the whole pose per phoneme; hold each pose, do not interpolate.",
            "Each body pose frame has its own mouth centre (MOUTH_BY_FRAME); frame 17 celebrate is squished and lower.",
            "Wave/celebrate keep the rest mouth; add vowel variants per body pose only when a lesson needs them.",
            "Fun props are drawn shapes on the idle body; a real basketball or juggling sequence in Mibo's own arms needs hand-drawn frames later.",
        ],
    }
    (OUT / "poses.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
