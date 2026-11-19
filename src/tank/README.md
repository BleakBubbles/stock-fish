# Tank renderer

- `Tank.tsx`: owns the PixiJS app. Draws the scene at its native size into a render texture, then
  shows it upscaled by a whole number, measured in device pixels. The scale fits a 320 × 180 tank;
  with only a few fish it zooms in (`tankZoom`), and the native size grows to fill the slot. The
  scene is resized to match (`scene.setSize`: frame, water, sand and plants, weather, swimming
  bounds). Fish labels live in `scene.overlay`, drawn over the upscaled tank at the larger of an
  art pixel and a UI pixel.
- `scene.ts`: the scene in art pixels (water, fish, night overlay, hit testing, regions, the
  selected fish's territory outline, dragging). No React.
- `decor.ts`: pure, seeded layout of a tank's floor (sand surface, specks, plants and rocks), so
  each pen always looks the same. The frame and decor art come from `art/decor/`.
- `swim.ts`: pure fish movement; positions round to whole art pixels only when drawn. How a fish
  swims (speed, rests, how far it darts) comes from its temperament (`src/mood/temperament.ts`).
- `model.ts`: pure derivation of what each fish shows (body, colours, mood, numbers) and the weather.
- `territory.ts`: pure, order-preserving treemap. Each fish's patch is sized by its value; holdings
  too small for a patch share a communal one, and no patch is cut thinner than a fish can swim in.
- `arrange.ts`: pure regions for each fish: a single pen's home (the user's saved order) or an
  overview of several pens (mood, species, family, weight, pen, free roam).
- `weather.ts`: pure shapes for the portfolio weather in the water: light shafts, rain streaks and
  surface ripples, and how much the water darkens. Preview any weather with `?weather=<name>`.

Sprites come from the atlas baked by `scripts/build-sprites.ts`; colours come from `src/theme`.
