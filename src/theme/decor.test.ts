import { describe, expect, it } from 'vitest';
import palette from '../../art/palette.json';
import { INNER_WATER } from '../tank/arrange';
import { TANK_HEIGHT, TANK_WIDTH } from '../tank/constants';
import { decorColour, decorFrames, decorItems } from './decor';
import { parseGrid, stretchFrame } from './grid';

const files = import.meta.glob('../../art/decor/*.grid', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const grids = Object.fromEntries(
  Object.entries(files).map(([path, text]) => [
    /([\w-]+)\.grid$/.exec(path)?.[1] ?? path,
    parseGrid(text),
  ]),
);

describe('decor art', () => {
  it('uses only palette colours from the decor legend', () => {
    for (const [name, rows] of Object.entries(grids)) {
      for (const row of rows) {
        for (const ch of row) {
          if (ch === '.') continue;
          expect(palette.colors, `${name}: ${ch}`).toContain(decorColour(ch));
        }
      }
    }
  });

  it('gives every swaying frame the same size as its still frame', () => {
    for (const [name, rows] of Object.entries(grids)) {
      if (!name.endsWith('-sway')) continue;
      const still = grids[name.slice(0, -'-sway'.length)];
      expect(still, name).toBeDefined();
      expect(rows.length).toBe(still?.length);
      expect(rows[0]?.length).toBe(still?.[0]?.length);
    }
  });

  it('stretches the frame to the tank, leaving exactly the inner water clear', () => {
    const frame = stretchFrame(grids.frame ?? [], TANK_WIDTH, TANK_HEIGHT);
    expect(frame).toHaveLength(TANK_HEIGHT);
    for (const row of frame) expect(row).toHaveLength(TANK_WIDTH);
    const inside = (x: number, y: number) =>
      x >= INNER_WATER.x &&
      x < INNER_WATER.x + INNER_WATER.w &&
      y >= INNER_WATER.y &&
      y < INNER_WATER.y + INNER_WATER.h;
    for (let y = 0; y < TANK_HEIGHT; y++) {
      for (let x = 0; x < TANK_WIDTH; x++) {
        const clear = frame[y]?.[x] === '.';
        // Inside: all water. Outside: all frame, except around the stand's legs.
        if (inside(x, y)) expect(clear, `${x},${y}`).toBe(true);
        else if (y < INNER_WATER.y + INNER_WATER.h + 5) expect(clear, `${x},${y}`).toBe(false);
      }
    }
  });

  it('bakes every grid into the atlas, the frame at full tank size', () => {
    expect(Object.keys(decorFrames).sort()).toEqual(Object.keys(grids).sort());
    expect(decorFrames.frame).toMatchObject({ w: TANK_WIDTH, h: TANK_HEIGHT });
    expect(decorItems().some((i) => i.name === 'frame')).toBe(false);
  });
});
