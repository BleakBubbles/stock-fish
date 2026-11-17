# Build scripts

`build-sprites.ts` (milestone 4) will port `art/tools/grid2png.py`: read `art/sprites/**/*.grid` and
`art/palette.json`, write the atlas and frame map to `src/theme/generated/` before `dev` and `build`.
