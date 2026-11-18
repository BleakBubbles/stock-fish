import { describe, expect, it } from 'vitest';
import { decorItems } from '../theme/decor';
import { INNER_WATER, SAND_TOP, WATER } from './arrange';
import { SAND_WAVE, decorLayout, seededRandom } from './decor';

const sizes = decorItems();
const layout = (seed: string) => decorLayout(seed, INNER_WATER, SAND_TOP, sizes);
const SEEDS = ['pen-1', 'pen-2', 'overview', 'a', 'b', 'c', 'd', 'e', 'f', 'g'];

describe('seededRandom', () => {
  it('repeats for the same seed and differs between seeds', () => {
    const a = seededRandom('x');
    const b = seededRandom('x');
    const c = seededRandom('y');
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
    expect(first.every((n) => n >= 0 && n < 1)).toBe(true);
  });
});

describe('decorLayout', () => {
  it('is the same every time for a tank, and different between tanks', () => {
    expect(layout('pen-1')).toEqual(layout('pen-1'));
    expect(layout('pen-1').items).not.toEqual(layout('pen-2').items);
  });

  it('keeps the sand close to its average line, across the whole water', () => {
    for (const seed of SEEDS) {
      const { sandTops } = layout(seed);
      expect(sandTops).toHaveLength(INNER_WATER.w);
      for (const top of sandTops) expect(Math.abs(top - SAND_TOP)).toBeLessThanOrEqual(SAND_WAVE);
    }
  });

  it('puts specks inside the sand', () => {
    for (const seed of SEEDS) {
      const { sandTops, specks } = layout(seed);
      expect(specks.length).toBeGreaterThan(20);
      for (const { x, y } of specks) {
        expect(y).toBeGreaterThan(sandTops[x - INNER_WATER.x] ?? Infinity);
        expect(y).toBeLessThan(INNER_WATER.y + INNER_WATER.h);
      }
    }
  });

  it('places plants and rocks inside the glass, side by side, standing in the sand', () => {
    for (const seed of SEEDS) {
      const { items, sandTops } = layout(seed);
      expect(items.filter((i) => !i.front).length).toBeGreaterThanOrEqual(2);
      expect(items.filter((i) => i.name.startsWith('rock')).length).toBeGreaterThanOrEqual(1);
      const spans = items.map((i) => {
        const size = sizes.find((s) => s.name === i.name);
        if (!size) throw new Error(i.name);
        expect(i.x).toBeGreaterThanOrEqual(INNER_WATER.x);
        expect(i.x + size.w).toBeLessThanOrEqual(INNER_WATER.x + INNER_WATER.w);
        // Its base sits in the sand, just below the surface under it.
        const under = sandTops.slice(i.x - INNER_WATER.x, i.x - INNER_WATER.x + size.w);
        const base = i.y + size.h;
        expect(base).toBeGreaterThan(Math.min(...under));
        expect(base).toBeLessThanOrEqual(Math.min(...under) + 3);
        // Tall plants stay below the lid and the top of the swimming water.
        expect(i.y).toBeGreaterThan(WATER.y);
        return [i.x, i.x + size.w] as const;
      });
      for (let a = 0; a < spans.length; a++) {
        for (let b = a + 1; b < spans.length; b++) {
          const [x1, r1] = spans[a] ?? [0, 0];
          const [x2, r2] = spans[b] ?? [0, 0];
          expect(r1 <= x2 || r2 <= x1).toBe(true);
        }
      }
    }
  });

  it('only rocks hold still', () => {
    const { items } = layout('pen-1');
    for (const i of items) expect(i.sway).toBe(!i.name.startsWith('rock'));
  });
});
