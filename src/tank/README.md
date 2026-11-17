# Tank renderer

- `Tank.tsx`: owns the PixiJS app. Draws the scene at native 320 × 180 into a render texture, then
  shows it upscaled by the largest whole number that fits, measured in device pixels.
- `scene.ts`: the scene in art pixels (water, fish, night overlay, hit testing). No React.
- `swim.ts`: pure fish movement; positions round to whole art pixels only when drawn.
- `model.ts`: pure derivation of what each fish shows (body, colours, mood, numbers) and the weather.

Sprites come from the atlas baked by `scripts/build-sprites.ts`; colours come from `src/theme`.
