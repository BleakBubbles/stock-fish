/**
 * The tank's sprite atlas, baked by scripts/build-sprites.ts into ./generated
 * (gitignored; `npm run sprites` regenerates it, and dev, build, typecheck and
 * test do so automatically).
 */
import type { AtlasFrameMap, AtlasLayer, TailPose } from './grid';
import type { Body, Face } from './sprites';
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

/** Where one layer of one body × face × tail pose sits in the atlas image. */
export function frameRect(
  body: Body,
  face: Face,
  layer: AtlasLayer,
  tail: TailPose = 'mid',
): FrameRect {
  const column = atlasFrames.columns[`${body}/${face}/${tail}`];
  const row = atlasFrames.layers.indexOf(layer);
  if (column === undefined || row === -1) {
    throw new Error(`No atlas frame for ${body}/${face}/${tail} (${layer})`);
  }
  return {
    x: column * atlasFrames.frameWidth,
    y: row * atlasFrames.frameHeight,
    width: atlasFrames.frameWidth,
    height: atlasFrames.frameHeight,
  };
}
