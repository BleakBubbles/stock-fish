#!/usr/bin/env python3
"""Render Stock Fish sprite grids to PNG.

Reference implementation of the sprite pipeline. The app build should port this
to a Node script; this version is for quick previews and for round-tripping
with Aseprite.

Usage:
  grid2png.py SPRITE.grid --ramp orange [--scale 8] [-o out.png]
  grid2png.py --atlas [--scale 1] [-o atlas.png]    # every body x mood x ramp, plus atlas.json

Grid legend: . clear | o outline | p pupil/lid/mouth | w eye white | r tongue
             B body (ramp.body) | F fins and tail (ramp.fin)
"""
import argparse
import json
from pathlib import Path

from PIL import Image

ART = Path(__file__).resolve().parent.parent
PALETTE = json.loads((ART / "palette.json").read_text())


def rgba(hexstr):
    return tuple(int(hexstr[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def read_grid(path):
    rows = [r.rstrip("\n") for r in Path(path).read_text().splitlines() if r and not r.startswith("#")]
    width = len(rows[0])
    if any(len(r) != width for r in rows):
        raise ValueError(f"{path}: rows have different lengths")
    return rows


def render(rows, ramp_name):
    ramp = PALETTE["ramps"][ramp_name]
    fixed = {k: v["color"] for k, v in PALETTE["roles"].items() if v["color"] and not v["color"].startswith("from")}
    colors = {**fixed, "B": ramp["body"], "F": ramp["fin"]}
    img = Image.new("RGBA", (len(rows[0]), len(rows)), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            if ch not in colors:
                raise ValueError(f"unknown grid character {ch!r} at {x},{y}")
            img.putpixel((x, y), rgba(colors[ch]))
    return img


def scale(img, s):
    return img if s == 1 else img.resize((img.width * s, img.height * s), Image.NEAREST)


def build_atlas(out, s):
    # Faces only: tail-*.grid hold just a tail pose (with ~ for "keep the face").
    sprites = sorted(p for p in (ART / "sprites").glob("*/*.grid") if not p.stem.startswith("tail-"))
    ramps = PALETTE["rampOrder"]
    first = read_grid(sprites[0])
    w, h = len(first[0]), len(first)
    atlas = Image.new("RGBA", (w * len(sprites), h * len(ramps)), (0, 0, 0, 0))
    frames = {}
    for ri, ramp in enumerate(ramps):
        for si, sp in enumerate(sprites):
            atlas.paste(render(read_grid(sp), ramp), (si * w, ri * h))
            frames[f"{sp.parent.name}/{sp.stem}/{ramp}"] = {"x": si * w, "y": ri * h, "w": w, "h": h}
    scale(atlas, s).save(out)
    Path(out).with_suffix(".json").write_text(json.dumps({"scale": s, "frames": frames}, indent=1))
    print(f"wrote {out} ({len(frames)} frames)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("grid", nargs="?")
    ap.add_argument("--ramp", default="orange")
    ap.add_argument("--scale", type=int, default=1)
    ap.add_argument("--atlas", action="store_true")
    ap.add_argument("-o", "--out")
    a = ap.parse_args()
    if a.atlas:
        build_atlas(a.out or "atlas.png", a.scale)
        return
    if not a.grid:
        ap.error("give a .grid file or --atlas")
    out = a.out or Path(a.grid).with_suffix(f".{a.ramp}.png")
    scale(render(read_grid(a.grid), a.ramp), a.scale).save(out)
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
