#!/usr/bin/env python3
"""Extract Quinn animation clips from quinn_moviment.mp4 (white-bg cartoon)."""
from __future__ import annotations

import json
import shutil
import subprocess
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
VIDEO = ROOT / "moviments" / "quinn_moviment.mp4"
OUT = ROOT / "public" / "assets" / "quinn"
RAW = ROOT / "tools" / "quinn_raw12"
FPS = 12
CELL_W, CELL_H = 128, 160
FOOT_Y = 154
BODY_H = 132

# Preview was 4 fps. Times in seconds from that pass:
CLIPS = {
    "walk": (0.20, 4.20, 10, 10),
    "jump": (5.05, 6.85, 8, 12),
    "punch": (7.05, 9.25, 8, 12),
    "idle": (9.55, 11.35, 8, 8),
    "shoot": (11.55, 14.35, 8, 12),
}


def extract() -> list[Path]:
    RAW.mkdir(parents=True, exist_ok=True)
    for old in RAW.glob("frame_*.png"):
        old.unlink()
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise SystemExit("ffmpeg not on PATH")
    cmd = [
        ffmpeg, "-y", "-i", str(VIDEO),
        "-vf", f"fps={FPS}",
        str(RAW / "frame_%04d.png"),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise SystemExit(proc.stderr[-2000:])
    frames = sorted(RAW.glob("frame_*.png"))
    print(f"extracted {len(frames)} frames @ {FPS} fps")
    return frames


def white_mask(rgb: np.ndarray) -> np.ndarray:
    r, g, b = rgb[:, :, 0].astype(np.int16), rgb[:, :, 1].astype(np.int16), rgb[:, :, 2].astype(np.int16)
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    return (mn >= 228) & ((mx - mn) <= 18)


def chroma_white(im: Image.Image) -> Image.Image:
    rgba = im.convert("RGBA")
    arr = np.array(rgba)
    rgb = arr[:, :, :3]
    h, w = rgb.shape[:2]
    key = white_mask(rgb)
    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()

    def seed(x: int, y: int) -> None:
        if key[y, x] and not visited[y, x]:
            visited[y, x] = True
            q.append((x, y))

    for y, x in ((0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)):
        seed(x, y)
    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)

    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny, nx] and key[ny, nx]:
                visited[ny, nx] = True
                q.append((nx, ny))

    out = arr.copy()
    out[visited, 3] = 0
    # Soft fringe: remaining near-white keyed pixels get reduced alpha.
    fringe = key & ~visited
    if fringe.any():
        out[fringe, 3] = (out[fringe, 3].astype(np.float32) * 0.15).astype(np.uint8)
    out[out[:, :, 3] == 0, :3] = 0
    return Image.fromarray(out, "RGBA")


def bbox(im: Image.Image, a: int = 24) -> tuple[int, int, int, int] | None:
    m = np.array(im)[:, :, 3] > a
    if not m.any():
        return None
    ys, xs = np.where(m)
    pad = 4
    return (
        max(0, int(xs.min()) - pad),
        max(0, int(ys.min()) - pad),
        min(im.width, int(xs.max()) + 1 + pad),
        min(im.height, int(ys.max()) + 1 + pad),
    )


def normalize(im: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    bb = bbox(im)
    if not bb:
        return canvas
    crop = im.crop(bb)
    cw, ch = crop.size
    scale = BODY_H / ch
    nw, nh = max(1, int(round(cw * scale))), max(1, int(round(ch * scale)))
    if nw > CELL_W - 4:
        scale = (CELL_W - 4) / cw
        nw, nh = max(1, int(round(cw * scale))), max(1, int(round(ch * scale)))
    if nh > CELL_H - 4:
        scale = (CELL_H - 4) / ch
        nw, nh = max(1, int(round(cw * scale))), max(1, int(round(ch * scale)))
    resized = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (CELL_W - nw) // 2
    y = FOOT_Y - nh
    y = max(0, min(y, CELL_H - nh))
    canvas.paste(resized, (x, y), resized)
    return canvas


def sample_range(n_total: int, t0: float, t1: float, want: int) -> list[int]:
    a = max(0, int(round(t0 * FPS)))
    b = min(n_total - 1, int(round(t1 * FPS)))
    if b <= a:
        return [a]
    span = list(range(a, b + 1))
    if want >= len(span):
        return span
    return [span[int(round(i * (len(span) - 1) / (want - 1)))] for i in range(want)]


def strip_of(frames: list[Image.Image]) -> Image.Image:
    strip = Image.new("RGBA", (CELL_W * len(frames), CELL_H), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        strip.paste(fr, (i * CELL_W, 0), fr)
    return strip


def gif_of(frames: list[Image.Image], path: Path, ms: int) -> None:
    out = []
    for fr in frames:
        bg = Image.new("RGBA", fr.size, (28, 24, 32, 255))
        bg.paste(fr, (0, 0), fr)
        out.append(bg.convert("P", palette=Image.ADAPTIVE, colors=240))
    out[0].save(path, save_all=True, append_images=out[1:], duration=ms, loop=0, disposal=2)


def main() -> None:
    frames = extract()
    n = len(frames)
    cleaned: list[Image.Image] = []
    for i, p in enumerate(frames):
        cleaned.append(chroma_white(Image.open(p)))
        if (i + 1) % 30 == 0 or i + 1 == n:
            print(f"  keyed {i + 1}/{n}")

    OUT.mkdir(parents=True, exist_ok=True)
    meta = {
        "source": str(VIDEO),
        "fps_src": FPS,
        "cell": [CELL_W, CELL_H],
        "clips": {},
    }

    for name, (t0, t1, want, anim_fps) in CLIPS.items():
        idxs = sample_range(n, t0, t1, want)
        sprites = [normalize(cleaned[i]) for i in idxs]
        sheet = strip_of(sprites)
        sheet.save(OUT / f"{name}.png")
        gif_of(sprites, OUT / f"{name}.gif", int(1000 / anim_fps))
        meta["clips"][name] = {
            "file": f"{name}.png",
            "frames": len(sprites),
            "frameWidth": CELL_W,
            "frameHeight": CELL_H,
            "fps": anim_fps,
            "loop": name in ("idle", "walk"),
            "sourceIndices": idxs,
        }
        print(f"{name}: {len(sprites)} frames  {idxs[0]}-{idxs[-1]}")

    # One-frame knockdown from a low punch pose if available
    punch_idxs = meta["clips"]["punch"]["sourceIndices"]
    down_src = cleaned[punch_idxs[min(3, len(punch_idxs) - 1)]]
    down = normalize(down_src).transpose(Image.ROTATE_90)
    # fit rotated into cell, feet-ish
    canvas = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    dw, dh = down.size
    scale = min((CELL_W - 8) / dw, (CELL_H - 20) / dh)
    nw, nh = max(1, int(dw * scale)), max(1, int(dh * scale))
    down = down.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(down, ((CELL_W - nw) // 2, CELL_H - nh - 6), down)
    canvas.save(OUT / "down.png")
    meta["clips"]["down"] = {
        "file": "down.png",
        "frames": 1,
        "frameWidth": CELL_W,
        "frameHeight": CELL_H,
        "fps": 1,
        "loop": False,
    }

    (OUT / "anims.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print("wrote", OUT / "anims.json")


if __name__ == "__main__":
    main()
