/**
 * Tank decoration: plants, rocks and the tank frame from art/decor, baked by
 * scripts/build-sprites.ts into ./generated/decor.png (each grid at its own
 * size, the frame stretched to the whole tank). Sand is drawn by the scene in
 * the decor colours below.
 */
import palette from '../../art/palette.json';
import type { DecorFrame } from './grid';
import frames from './generated/decor.json';
import decorUrl from './generated/decor.png';
import type { Hex } from './index';

export { decorUrl };
export const decorFrames = frames as Record<string, DecorFrame>;

const legend = palette.decor as Record<string, string>;

/** The sand's colours: its pale top edge, the sand itself, and the specks in it. */
export const sand: { edge: Hex; base: Hex; speck: Hex } = {
  edge: decorColour('e'),
  base: decorColour('s'),
  speck: decorColour('S'),
};

/** Colour of a decor grid character (art/palette.json "decor"). */
export function decorColour(ch: string): Hex {
  const hex = ch.startsWith('_') ? undefined : legend[ch];
  if (!hex) throw new Error(`palette.json has no decor colour for ${ch}`);
  return hex;
}

/** The decor items a tank can place (not the frame), with their sizes; `sway` if there's a swaying frame. */
export function decorItems(): { name: string; w: number; h: number; sway: boolean }[] {
  return Object.entries(decorFrames)
    .filter(([name]) => name !== 'frame' && !name.startsWith('badge-') && !name.endsWith('-sway'))
    .map(([name, f]) => ({ name, w: f.w, h: f.h, sway: `${name}-sway` in decorFrames }));
}
