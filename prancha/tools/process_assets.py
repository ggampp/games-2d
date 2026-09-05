#!/usr/bin/env python3
"""Copy session generations, chroma-key sprites, write the PRANCHA asset pack."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

try:
    from scipy import ndimage
except ImportError:
    ndimage = None

SESSION = Path(
    r"C:\Users\ggamp\.grok\sessions\D%3A%5Cclaude_projects%5Cdev-games%5Cgames-2d%5Cprancha"
    r"\01a063e8-ca43-7d10-b9e2-fdec9cd36695\images"
)
ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "assets" / "raw"
OUT = ROOT / "assets"

# source stem -> (relpath without ext, chroma?)
MAP = {
    "1": ("sprites/materials/mat_wood_beam", True),
    "2": ("sprites/materials/mat_bearing", True),
    "3": ("sprites/materials/mat_joint_node", True),
    "5": ("sprites/materials/mat_steel_ibeam", True),
    "7": ("sprites/materials/mat_concrete_beam", True),
    "8": ("sprites/materials/mat_cable", True),
    "9": ("sprites/structures/abut_left", True),
    "10": ("sprites/ui/icon_steel", True),
    "11": ("sprites/structures/scaffold", True),
    "12": ("sprites/vehicles/veh_bus", True),
    "13": ("sprites/ui/icon_concrete", True),
    "15": ("sprites/structures/abut_right", True),
    "18": ("sprites/ui/icon_wood", True),
    "19": ("sprites/fx/fx_debris_sheet", True),
    "20": ("sprites/ui/icon_bearing", True),
    "21": ("sprites/fx/fx_splash", True),
    "22": ("sprites/fx/fx_dust", True),
    "24": ("sprites/ui/icon_cable", True),
    "33": ("sprites/vehicles/veh_van", True),
    "34": ("sprites/vehicles/veh_box_truck", True),
    "35": ("sprites/vehicles/veh_bitrem", True),
    "36": ("sprites/vehicles/veh_truck", True),
    "38": ("sprites/structures/pier", True),
    "17": ("env/canyon/sky", False),
    "23": ("env/canyon/far", False),
    "27": ("env/canyon/near", False),
    "28": ("env/canyon/gameplay_plate", False),
    "30": ("env/canyon/mid", False),
    "31": ("env/canyon/water", False),
    "25": ("env/plains/sky", False),
    "26": ("env/plains/water", False),
    "29": ("env/plains/far", False),
    "32": ("env/plains/aerial_plate", False),
    "37": ("env/plains/gameplay_plate", False),
}

ICON_IDS = {
    "icon_steel",
    "icon_concrete",
    "icon_wood",
    "icon_bearing",
    "icon_cable",
}


def magenta_like(rgb: np.ndarray) -> np.ndarray:
    r = rgb[..., 0].astype(np.float32)
    g = rgb[..., 1].astype(np.float32)
    b = rgb[..., 2].astype(np.float32)
    mag_pair = np.minimum(r, b)
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = (mx - mn) / np.maximum(mx, 1.0)
    # Pink / magenta key: R and B high, G relatively low, some saturation.
    return (
        (r > 150)
        & (b > 110)
        & (g < mag_pair * 0.72)
        & (sat > 0.16)
        & (mag_pair > 120)
    )


def chroma_key(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    arr = np.array(rgba)
    rgb = arr[..., :3]
    key = magenta_like(rgb)
    alpha = arr[..., 3].astype(np.float32)
    alpha[key] = 0

    # Despill remaining pink fringe.
    r = arr[..., 0].astype(np.float32)
    g = arr[..., 1].astype(np.float32)
    b = arr[..., 2].astype(np.float32)
    fringe = (~key) & (r > 140) & (b > 100) & (g < np.minimum(r, b) * 0.85)
    if fringe.any():
        spill = np.clip((np.minimum(r, b) - g) / 255.0, 0, 1)
        r = np.where(fringe, r - spill * 80, r)
        b = np.where(fringe, b - spill * 80, b)
        alpha = np.where(fringe, alpha * (1.0 - spill * 0.65), alpha)

    out = np.stack(
        [
            np.clip(r, 0, 255).astype(np.uint8),
            np.clip(g, 0, 255).astype(np.uint8),
            np.clip(b, 0, 255).astype(np.uint8),
            np.clip(alpha, 0, 255).astype(np.uint8),
        ],
        axis=-1,
    )
    result = Image.fromarray(out, "RGBA")
    bbox = result.getbbox()
    if bbox:
        pad = 8
        x0, y0, x1, y1 = bbox
        x0 = max(0, x0 - pad)
        y0 = max(0, y0 - pad)
        x1 = min(result.width, x1 + pad)
        y1 = min(result.height, y1 + pad)
        result = result.crop((x0, y0, x1, y1))
    return result


def fit_icon(img: Image.Image, size: int = 256) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    w, h = img.size
    if w == 0 or h == 0:
        return canvas
    scale = min(size / w, size / h) * 0.86
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
    return canvas


def extract_debris(sheet: Image.Image, dest: Path) -> list[str]:
    arr = np.array(sheet)
    alpha = arr[..., 3] > 24
    if ndimage is None:
        sheet.save(dest / "fx_debris_sheet.png")
        return ["sprites/fx/fx_debris_sheet.png"]
    labeled, n = ndimage.label(alpha)
    files: list[str] = []
    idx = 0
    for i in range(1, n + 1):
        ys, xs = np.where(labeled == i)
        if ys.size < 400:
            continue
        miny, maxy = int(ys.min()), int(ys.max())
        minx, maxx = int(xs.min()), int(xs.max())
        crop = sheet.crop((minx, miny, maxx + 1, maxy + 1))
        idx += 1
        name = f"fx_debris_{idx:02d}.png"
        crop.save(dest / name)
        files.append(f"sprites/fx/{name}")
    return files


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    manifest: list[dict] = []
    debris_files: list[str] = []

    for stem, (rel, chroma) in MAP.items():
        src = SESSION / f"{stem}.jpg"
        if not src.exists():
            print(f"MISSING {src.name}")
            continue
        raw_path = RAW / f"{Path(rel).name}.jpg"
        shutil.copy2(src, raw_path)
        dest = OUT / f"{rel}.png"
        dest.parent.mkdir(parents=True, exist_ok=True)
        img = Image.open(src)
        if chroma:
            processed = chroma_key(img)
            if dest.stem in ICON_IDS:
                processed = fit_icon(processed, 256)
            processed.save(dest)
            if dest.stem == "fx_debris_sheet":
                debris_files = extract_debris(processed, dest.parent)
        else:
            img.convert("RGB").save(dest, quality=92)
        bbox = None
        if chroma:
            with Image.open(dest) as done:
                bbox = list(done.size)
        manifest.append(
            {
                "id": dest.stem,
                "file": dest.relative_to(OUT).as_posix(),
                "raw": raw_path.relative_to(OUT).as_posix(),
                "chroma": chroma,
                "size": bbox,
            }
        )
        print(f"OK {dest.relative_to(ROOT)}")

    if debris_files:
        manifest.append({"id": "fx_debris_pack", "files": debris_files, "chroma": True})

    (OUT / "manifest.json").write_text(
        json.dumps(
            {
                "game": "PRANCHA",
                "version": "1.0-assets",
                "chroma": "#FF00FF (adaptive pink/magenta key)",
                "note": "UI text is code, not baked in sprites.",
                "assets": manifest,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(f"Wrote {len(manifest)} entries")


if __name__ == "__main__":
    main()
