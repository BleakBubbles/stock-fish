# Stock Fish sprite style guide

Every sprite in `sprites/` follows these rules. Read this file before drawing or editing a sprite,
and compare any new sprite against the reference set in `preview/flat_set.png`.

## Format

- One sprite per file: `sprites/<n>-<sector>-<shape>/<mood>.grid`.
- Canvas: **32 × 25** characters, one character per pixel, facing right.
- Legend:

| Char | Meaning | Colour |
| --- | --- | --- |
| `.` | transparent | — |
| `o` | outline | 181425 |
| `p` | pupil, eyelid line, mouth | 181425 |
| `w` | eye white | ffffff |
| `r` | tongue (ecstatic only) | e43b44 |
| `B` | body | ramp body colour |
| `F` | fins and tail | ramp fin colour |

Sprites store roles, never colours. `palette.json` maps `B` and `F` to a ramp, so one drawn fish
becomes any species colour. Mood never changes colour.

## Rules

1. **Flat colours, no shading.** Only the roles above. No highlights, no shadows, no dithering.
2. **Horizontal only.** No rotation, ever. Mirroring to face left is allowed.
3. **Black outline on every edge** that touches transparency. White outlines are a runtime
   effect for hover and selection only, never drawn into sprites.
4. **Exaggerated body shapes.** The outline alone must say which sector a fish belongs to.
5. **Anatomically plausible fins** per body. Fins are anatomy, not mood: every mood of a body
   uses the same fins.
6. **Fins and tails at least 2–3 px thick**, with rounded (2–3 px wide) tips. No 1-px spikes,
   no single-pixel tips, no detached or stray pixels.
7. **Even line steps** on curves and diagonals (1:1, 2:1), no ragged stair-steps.
8. **Eye A:** 4 × 4, white with rounded corners (corners show body colour), 2 × 2 pupil.
9. **The mouth comes in from the right edge** (the nose) on one mouth row per body.
10. **Water is navy 262b44.** No fish ramp may use it as body or fin colour.

## Mood faces

Eye templates (4 × 4; `B` = body showing through, `W` = white, `P` = dark):

| Mood | Eye rows | Mouth |
| --- | --- | --- |
| Ecstatic | `BWPB` `WWPP` `WWWW` `BWWB` (looking up) | Open mouth with tongue; on pointed noses a small grin plus tongue |
| Happy | `BWWB` `WWPP` `WWPP` `BWWB` | Upturned line |
| Neutral | `BBBB` `WWPP` `WWPP` `BWWB` (lid slightly lowered) | Flat line |
| Uneasy | `BWWB` `PPWW` `PPWW` `BWWB` (glancing back) | Wavy line; shorter on pointed noses |
| Sad | `BBBB` `PPPP` `WWPP` `BPPB` (drooping lid, pupil down) | Downturned line |

## Bodies

| Folder | Sectors (GICS) | Shape | Fins |
| --- | --- | --- | --- |
| `1-tech-triangle` | Information Technology, Communication Services | Wedge, blunt nose | Small swept-back dorsal + anal pair |
| `2-finance-boxfish` | Financials, Real Estate | Square | Small dorsal + anal set far back |
| `3-consumer-pufferfish` | Consumer Discretionary, Consumer Staples | Circle | Dorsal + anal pair set back; no pelvic fins |
| `4-energy-diamond` | Energy, Utilities | True diamond | Tall swept-back angelfish fins |
| `5-industrial-sawfish` | Industrials, Materials | Long body, toothed snout | Shark first dorsal, small second dorsal, broad pectorals, shark tail |
| `6-health-capsule` | Health Care | Capsule | Long swept-back dorsal, shorter anal (goby-like) |

## Tools

- `tools/grid2png.py SPRITE.grid --ramp orange --scale 8` renders a preview.
- `tools/grid2png.py --atlas` builds an atlas of every body × mood × ramp, plus a JSON frame map.
- `tools/png2grid.py edited.png --ramp orange` converts a 1× PNG edited in Aseprite back to a grid.

## Not drawn yet

Sleeping face (market closed), tail-wag animation frames (2–3 per loop), code-generated
patterns, special bodies for ETFs, funds and crypto.
