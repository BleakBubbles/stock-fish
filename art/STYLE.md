# Bullish Sharks sprite style guide

Every sprite in `sprites/` follows these rules. Read this file before drawing or editing a sprite,
and compare any new sprite against the reference set in `preview/flat_set.png`.

## Format

- One sprite per file: `sprites/<n>-<sector>-<shape>/<face>.grid`, where a face is a mood or
  `sleeping`, plus two tail poses per body (`tail-up.grid`, `tail-down.grid`; see below).
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
becomes any species colour. Mood never changes a fish's colour. Mood badges (`art/badges`, 9 × 9)
are the one tinted thing: `n` outline and features, `i` face, filled with the mood's `moodBadge`
colour. Each face must read in white too.

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
| Sleeping | `BBBB` `BBBB` `PBBP` `BPPB` (closed, a lid curve; never paint over outline) | Short flat line, 2 px at the nose |

Fish sleep while the market is closed; tapping one wakes it to show its mood.

## Tail poses

Fish wag while swimming: mid (the tail as drawn in each face), up, mid, down. `tail-up.grid` and
`tail-down.grid` draw only the tail; every other cell is `~`, meaning "keep the face's pixel", and
the build lays each pose over every face. Up makes the upper lobe one row longer and the lower lobe
one row shorter (down is the reverse), changing length at the stem so each tip keeps its shape,
and both are one pixel shorter than mid: the tail flaps side
to side, so at its extremes it's foreshortened, curling toward or away from the viewer. Free lobe
pieces slide in whole (keeping fins 2+ px thick); a stalk is never thinned to nothing. Outlines
stay whole and the base never moves. 1-pixel changes are enough: they read in motion. `preview/swim_and_sleep.gif` shows the set.

## Bodies

| Folder | Sectors (GICS) | Shape | Fins |
| --- | --- | --- | --- |
| `1-tech-hammerhead` | Information Technology, Communication Services | Hammerhead: a tall, thin hammer at the front, the eye at its top | Tall dorsal, long upper tail lobe |
| `2-finance-great-white` | Financials, Real Estate | Great white: straight back, curved belly, tall blunt snout | Big triangular dorsal; toothy grin (fixed teeth, `w`) |
| `3-consumer-nurse` | Consumer Discretionary, Consumer Staples | Nurse shark: slim and low, blunt head | Two swept-back dorsals near the tail; big upper tail lobe, small lower one |
| `4-energy-thresher` | Energy, Utilities | Thresher: compact body | A huge whip of an upper tail lobe tapering to a point |
| `5-industrial-sawshark` | Industrials, Materials | Sawshark: slim body, long toothed saw | Dorsal, pectoral, shark tail |
| `6-health-angel` | Health Care | Angel shark: very flat, eye on top | Broad wing-like pectorals, two small dorsals near the tail |
| `7-fund-whale-shark` | Funds (ETFs, mutual funds) | Whale shark: boxy, flat-topped, spotted (`F`) | Wide mouth right across the front |
| `8-crypto-mako` | Crypto | Mako: slim, streamlined, full pointed snout | Small dorsal, tall crescent tail whose lobes meet; fixed teeth (`w`) |

The fish of the first versions were replaced by sharks (November 2026). Teeth are drawn in `w`
below the mouth line and stay put with every mood; asleep they hide. The thresher's whip tail is
the one exception to rule 6: its tip is a single pixel, because a whip that ends blunt stops
reading as a thresher.

## App icon and logo

The app icon is a megalodon tooth, green like a price rise: `ui/app-icon.grid` (32 × 32) and,
redrawn 14 pixels tall for the title bar, `ui/logo.grid`. Crown (`G`) with serrated edges and an
arched bourlette (`g`), a wide two-lobed root (`d`), outline (`o`); colours from `palette.json`
`ui.logo`. It is shaded more than the sharks on purpose: it's a badge, not a tank resident.
`npm run icons` makes `public/icons` from the 32 × 32 grid.

## UI font

`fonts/silkscreen.font` is Silkscreen (SIL OFL 1.1, see `fonts/OFL-Silkscreen.txt`) as a bitmap
font: one block per character, `#` for ink and `.` for clear, 9 rows tall with 8 rows above the
baseline and capitals 5 rows tall. Edit glyphs like sprites. Characters the font lacks are
substituted (e.g. minus sign → hyphen) or drawn as `?`.

## Tank decor

`decor/` holds the tank's frame, plants and rocks as grids of any size. Their characters map to
palette colours through `palette.json` `decor` (not the fish roles above).

- **No black outline.** Decor sits behind the fish, so it stays flat and unoutlined; only fish
  get the outline.
- **Flat or shaded.** Decor grids are drawn with light and dark shades (plants `g`/`G`/`d`, rocks
  `h`/`R`/`r`, the sand's edge and specks, the frame's lid and stand). `palette.json`
  `decorStyle` picks how they show: `"flat"` (current) gives each shade listed in `decorFlat` its
  base colour, so decor has no lighting or shading, like the fish; `"shaded"` uses every colour
  as drawn. Keep drawing the shades: switching back needs no art changes. Plants are greens (`g` light, `G`, `d` dark), rocks greys (`h`, `R`, `r`).
- **Sway:** a plant with a `NAME-sway.grid` alternates with it. The swayed frame is the same
  size, with its upper part shifted one pixel. Rocks have no sway frame and hold still.
- **Kinds** go by name: `kelp-*` and `sword-*` stand behind the sand's edge; `rock-*` and
  `grass-*` in front of it. Each tank picks a few of each and places them along the floor,
  seeded by its pen, so a tank always looks the same.
- **Sand** is drawn by the app, not a grid: `s` sand, a pale `e` top edge, `S` specks.
- **`frame.grid`** is the lid, glass edges, rim and stand, stretched to the tank's size in the app:
  the middle column repeats across, and the first row with water (`.`) in the middle repeats
  down. Its sizes must match `FRAME` in `src/tank/constants.ts` (a test checks).

## Tools

- `tools/grid2png.py SPRITE.grid --ramp orange --scale 8` renders a preview.
- `tools/grid2png.py --atlas` builds an atlas of every body × mood × ramp, plus a JSON frame map.
- `tools/png2grid.py edited.png --ramp orange` converts a 1× PNG edited in Aseprite back to a grid.

## Not drawn yet

Code-generated patterns.
