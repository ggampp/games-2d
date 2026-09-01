"""Pack CraftPix Battle of Heroes PNG frames into Phaser atlases."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PNG = ROOT / "Png"
OUT = ROOT / "game" / "public" / "assets"

CELL_W, CELL_H = 200, 176
PAD = 4
MAX_FRAMES = {
    "idle": 8,
    "walk": 8,
    "attack": 10,
    "hit": 5,
    "death": 8,
}

ANIM_FOLDERS = {
    "idle": ["Idle"],
    "walk": ["Walk"],
    "attack": ["Attack"],
    "hit": ["Get Hit"],
    "death": ["Death"],
}


def sample(files: list[Path], n: int) -> list[Path]:
    files = sorted(files)
    if len(files) <= n:
        return files
    if n <= 1:
        return [files[0]]
    return [files[round(i * (len(files) - 1) / (n - 1))] for i in range(n)]


def find_anim_dir(char_dir: Path, names: list[str]) -> Path | None:
    for name in names:
        p = char_dir / name
        if p.is_dir():
            return p
    lower = {c.name.lower(): c for c in char_dir.iterdir() if c.is_dir()}
    for name in names:
        if name.lower() in lower:
            return lower[name.lower()]
    return None


def place_in_cell(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    bbox = im.getbbox()
    if not bbox:
        return Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    crop = im.crop(bbox)
    max_w, max_h = CELL_W - PAD * 2, CELL_H - PAD
    scale = min(max_w / crop.width, max_h / crop.height, 1.0)
    nw, nh = max(1, int(crop.width * scale)), max(1, int(crop.height * scale))
    crop = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    cell = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    x = (CELL_W - nw) // 2
    y = CELL_H - nh - 2
    cell.alpha_composite(crop, (x, y))
    return cell


def pack_frames(frames: list[tuple[str, Image.Image]], dest_png: Path, dest_json: Path, image_name: str) -> None:
    n = len(frames)
    cols = min(8, max(1, n))
    rows = (n + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * CELL_W, rows * CELL_H), (0, 0, 0, 0))
    atlas = {"frames": {}, "animations": {}, "meta": {
        "app": "battle-of-heroes-packer",
        "version": "1.0",
        "image": image_name,
        "format": "RGBA8888",
        "size": {"w": cols * CELL_W, "h": rows * CELL_H},
        "scale": "1",
    }}
    for i, (name, img) in enumerate(frames):
        cx, cy = (i % cols) * CELL_W, (i // cols) * CELL_H
        sheet.alpha_composite(img, (cx, cy))
        atlas["frames"][name] = {
            "frame": {"x": cx, "y": cy, "w": CELL_W, "h": CELL_H},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": CELL_W, "h": CELL_H},
            "sourceSize": {"w": CELL_W, "h": CELL_H},
            "pivot": {"x": 0.5, "y": 1.0},
        }
    dest_png.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(dest_png, optimize=True)
    dest_json.write_text(json.dumps(atlas), encoding="utf-8")


def pack_character(index: int) -> dict:
    char_dir = PNG / "Characters" / f"Characters {index:02d}"
    frames: list[tuple[str, Image.Image]] = []
    counts: dict[str, int] = {}
    for anim, folders in ANIM_FOLDERS.items():
        folder = find_anim_dir(char_dir, folders)
        if not folder:
            counts[anim] = 0
            continue
        files = sample(list(folder.glob("*.png")), MAX_FRAMES[anim])
        counts[anim] = len(files)
        for i, f in enumerate(files):
            frames.append((f"{anim}_{i:02d}", place_in_cell(Image.open(f))))
    key = f"char{index:02d}"
    pack_frames(frames, OUT / "chars" / f"{key}.png", OUT / "chars" / f"{key}.json", f"{key}.png")
    hit_frame = max(0, counts.get("attack", 1) // 2)
    print(f"packed {key} frames={len(frames)} {counts}")
    return {"key": key, "counts": counts, "hitFrame": hit_frame}


def pack_fx() -> dict:
    result = {}
    for name, folder in [("fx01", "Fx01"), ("fx02", "Fx02"), ("fx03", "Fx03")]:
        src = PNG / "Fx" / folder
        files = sorted(src.glob("*.png"), key=lambda p: int("".join(ch for ch in p.stem if ch.isdigit()) or "0"))
        frames = []
        for i, f in enumerate(files):
            im = Image.open(f).convert("RGBA")
            bbox = im.getbbox() or (0, 0, im.width, im.height)
            crop = im.crop(bbox)
            crop.thumbnail((160, 160), Image.Resampling.LANCZOS)
            cell = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
            cell.alpha_composite(crop, ((160 - crop.width) // 2, (160 - crop.height) // 2))
            frames.append((f"fx_{i:02d}", cell))
        global CELL_W, CELL_H
        old = (CELL_W, CELL_H)
        CELL_W, CELL_H = 160, 160
        pack_frames(frames, OUT / "fx" / f"{name}.png", OUT / "fx" / f"{name}.json", f"{name}.png")
        CELL_W, CELL_H = old
        result[name] = len(frames)
        print(f"packed {name} {len(frames)}")
    return result


def copy_tree():
    mapping = [
        (PNG / "Heroes Icon", OUT / "icons"),
        (PNG / "Projectile", OUT / "projectiles"),
        (PNG / "Barrack", OUT / "barracks"),
        (PNG / "User interfaces", OUT / "ui"),
    ]
    for src, dst in mapping:
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
        print("copied", src.name)

    bg_out = OUT / "bg"
    bg_out.mkdir(parents=True, exist_ok=True)
    for i in range(1, 10):
        sample = PNG / "Stage Backgrounds" / f"Background{i:02d}" / "Sample.png"
        shutil.copy2(sample, bg_out / f"bg{i:02d}.png")
        layer = PNG / "Stage Backgrounds" / f"Background{i:02d}" / "Layer01.png"
        if layer.exists():
            shutil.copy2(layer, bg_out / f"sky{i:02d}.png")
    print("copied backgrounds")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    copy_tree()
    manifest = {"characters": [], "fx": {}}
    for i in range(1, 21):
        manifest["characters"].append(pack_character(i))
    manifest["fx"] = pack_fx()
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("done")


if __name__ == "__main__":
    main()
