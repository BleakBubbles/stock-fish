/**
 * The tank's sprite atlas, baked by scripts/build-sprites.ts into ./generated
 * (gitignored; `npm run sprites` regenerates it, and dev, build, typecheck and
 * test do so automatically).
 */
import type { Mood } from '../mood/types';
import type { AtlasFrameMap, AtlasLayer } from './grid';
import type { Body } from './sprites';
import frames from './generated/atlas.json';
import atlasUrl from './generated/atlas.png';

export { atlasUrl };
export const atlasFrames = frames as AtlasFrameMap;

export interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where one layer of one body × mood sits in the atlas image. */
export function frameRect(body: Body, mood: Mood, layer: AtlasLayer): FrameRect {
  const column = atlasFrames.columns[`${body}/${mood}`];
  const row = atlasFrames.layers.indexOf(layer);
  if (column === undefined || row === -1) {
    throw new Error(`No atlas frame for ${body}/${mood} (${layer})`);
  }
  return {
    x: column * atlasFrames.frameWidth,
    y: row * atlasFrames.frameHeight,
    width: atlasFrames.frameWidth,
    height: atlasFrames.frameHeight,
  };
}
