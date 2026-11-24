#!/usr/bin/env python3
"""Convert a 1x PNG (e.g. edited in Aseprite) back into a Bullish Sharks sprite grid.

Usage:
  png2grid.py edited.png --ramp orange [-o sprite.grid]

Pixels are mapped back to grid roles by colour: the ramp's body and fin colours
become B and F, 181425 becomes o (outline; pupil/mouth pixels share this colour,
so they also come back as o, which renders identically), ffffff becomes w, and
e43b44 becomes r unless it is the ramp's fin colour. Transparent pixels become '.'.
"""
import argparse
import json
from pathlib import Path

from PIL import Image

ART = Path(__file__).resolve().parent.parent
PALETTE = json.loads((ART / "palette.json").read_text())


def hexof(px):
    return "%02x%02x%02x" % px[:3]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("png")
    ap.add_argument("--ramp", default="orange")
    ap.add_argument("-o", "--out")
    a = ap.parse_args()
    ramp = PALETTE["ramps"][a.ramp]
    lookup = {"181425": "o", "ffffff": "w", "e43b44": "r", ramp["body"]: "B", ramp["fin"]: "F"}
    img = Image.open(a.png).convert("RGBA")
    rows = []
    for y in range(img.height):
        row = ""
        for x in range(img.width):
            px = img.getpixel((x, y))
            if px[3] == 0:
                row += "."
                continue
            h = hexof(px)
            if h not in lookup:
                raise SystemExit(f"colour {h} at {x},{y} is not a role colour for ramp {a.ramp}")
            row += lookup[h]
        rows.append(row)
    out = a.out or Path(a.png).with_suffix(".grid")
    Path(out).write_text("\n".join(rows) + "\n")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
