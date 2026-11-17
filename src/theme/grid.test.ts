import { describe, expect, it } from 'vitest';
import { buildAtlas, parseGrid } from './grid';

const FIXED = { o: '000000', p: '111111', w: 'ffffff', r: 'ff0000' };

/** RGBA at (x, y) of the atlas image. */
function at(image: { width: number; pixels: Uint8Array }, x: number, y: number): number[] {
  const i = (y * image.width + x) * 4;
  return [...image.pixels.subarray(i, i + 4)];
}

describe('parseGrid', () => {
  it('drops comments and blank lines', () => {
    expect(parseGrid('# c\r\n..\r\n\r\noo\n')).toEqual(['..', 'oo']);
  });
});

describe('buildAtlas', () => {
  const sprite = ['.....', '.oBF.', '.pwr.', '.....'];
  const { image, frames } = buildAtlas({ '1/happy': sprite, '1/sad': sprite }, FIXED);

  it('lays out one column per sprite and one row per layer', () => {
    expect(frames).toMatchObject({ frameWidth: 5, frameHeight: 4 });
    expect(frames.layers).toEqual(['fixed', 'body', 'fin', 'highlight']);
    expect(frames.columns).toEqual({ '1/happy': 0, '1/sad': 1 });
    expect(image.width).toBe(10);
    expect(image.height).toBe(16);
  });

  it('puts fixed roles in colour and body/fin as white masks', () => {
    expect(at(image, 1, 1)).toEqual([0, 0, 0, 255]); // o
    expect(at(image, 3, 2)).toEqual([255, 0, 0, 255]); // r
    expect(at(image, 2, 1)).toEqual([0, 0, 0, 0]); // B is not in the fixed layer
    expect(at(image, 2, 4 + 1)).toEqual([255, 255, 255, 255]); // B in the body layer
    expect(at(image, 3, 8 + 1)).toEqual([255, 255, 255, 255]); // F in the fin layer
    expect(at(image, 1, 4 + 1)).toEqual([0, 0, 0, 0]);
  });

  it('draws a highlight ring around the silhouette only', () => {
    expect(at(image, 0, 12 + 0)).toEqual([255, 255, 255, 255]); // diagonal neighbour
    expect(at(image, 4, 12 + 2)).toEqual([255, 255, 255, 255]);
    expect(at(image, 2, 12 + 1)).toEqual([0, 0, 0, 0]); // inside the fish
  });

  it('rejects unknown characters and mismatched sizes', () => {
    expect(() => buildAtlas({ a: ['.x.'] }, FIXED)).toThrow(/unknown grid character/);
    expect(() => buildAtlas({ a: ['...'], b: ['....'] }, FIXED)).toThrow(/must be/);
  });
});
