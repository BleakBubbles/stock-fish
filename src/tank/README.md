# Tank renderer

- `Tank.tsx`: owns the PixiJS app. Draws the scene at native 320 × 180 into a render texture, then
  shows it upscaled by the largest whole number that fits, measured in device pixels.
- `scene.ts`: the scene in art pixels (water, fish, night overlay, hit testing, regions, the
  selected fish's territory outline, dragging). No React.
- `swim.ts`: pure fish movement; positions round to whole art pixels only when drawn.
- `model.ts`: pure derivation of what each fish shows (body, colours, mood, numbers) and the weather.
- `territory.ts`: pure, order-preserving treemap. Each fish's patch is sized by its value; holdings
  too small for a patch share a communal one, and no patch is cut thinner than a fish can swim in.
- `arrange.ts`: pure regions for each fish: a single pen's home (the user's saved order) or an
  overview of several pens (mood, species, family, weight, pen, free roam).

Sprites come from the atlas baked by `scripts/build-sprites.ts`; colours come from `src/theme`.
