import { describe, expect, it } from 'vitest';
import { type Rect, applyLayout, layoutTerritory, orderedTreemap, reorder } from './territory';

const FISH = { w: 32, h: 25 };
const TANK: Rect = { x: 0, y: 6, w: 320, h: 170 };
const area = (r: Rect) => r.w * r.h;

/** Rectangles tile `outer` exactly: whole pixels, no overlaps, no gaps. */
function expectTiling(rects: Rect[], outer: Rect) {
  for (const r of rects) {
    for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isInteger(v)).toBe(true);
    expect(r.w).toBeGreaterThan(0);
    expect(r.h).toBeGreaterThan(0);
    expect(r.x).toBeGreaterThanOrEqual(outer.x);
    expect(r.y).toBeGreaterThanOrEqual(outer.y);
    expect(r.x + r.w).toBeLessThanOrEqual(outer.x + outer.w);
    expect(r.y + r.h).toBeLessThanOrEqual(outer.y + outer.h);
  }
  expect(rects.reduce((a, r) => a + area(r), 0)).toBe(area(outer));
}

describe('orderedTreemap', () => {
  it('tiles the rect with areas close to the weights', () => {
    const weights = [50, 20, 15, 10, 5];
    const rects = orderedTreemap(weights, TANK, FISH);
    expectTiling(rects, TANK);
    rects.forEach((r, i) => {
      expect(area(r) / area(TANK)).toBeCloseTo((weights[i] ?? 0) / 100, 1);
    });
  });

  it('first cut goes across the longer side (the tank is wide)', () => {
    const [a, b] = orderedTreemap([1, 1], TANK, FISH);
    expect(a).toEqual({ x: 0, y: 6, w: 160, h: 170 });
    expect(b).toEqual({ x: 160, y: 6, w: 160, h: 170 });
  });

  it('a small weight change moves patches a little, never reorders them', () => {
    const before = orderedTreemap([40, 30, 20, 10], TANK, FISH);
    const after = orderedTreemap([42, 29, 19, 10], TANK, FISH);
    before.forEach((r, i) => {
      const s = after[i] as Rect;
      expect(Math.abs(s.x - r.x) + Math.abs(s.y - r.y)).toBeLessThanOrEqual(8);
    });
  });
});

describe('layoutTerritory', () => {
  const MIN = 40 * 32;

  it('one patch per item when all are big enough', () => {
    const patches = layoutTerritory(
      [
        { id: 'a', weight: 3 },
        { id: 'b', weight: 1 },
      ],
      TANK,
      MIN,
      FISH,
    );
    expect(patches.map((p) => p.ids)).toEqual([['a'], ['b']]);
    expectTiling(
      patches.map((p) => p.rect),
      TANK,
    );
    expect(area(patches[0]!.rect)).toBeCloseTo(area(TANK) * 0.75, -2);
  });

  it('tiny holdings share one communal patch, at the end, of at least the minimum size', () => {
    const items = [
      { id: 'big', weight: 1000 },
      { id: 't1', weight: 1 },
      { id: 'mid', weight: 300 },
      { id: 't2', weight: 2 },
    ];
    const patches = layoutTerritory(items, TANK, MIN, FISH);
    expect(patches.map((p) => p.ids)).toEqual([['big'], ['mid'], ['t1', 't2']]);
    expect(patches[2]!.communal).toBe(true);
    expect(area(patches[2]!.rect)).toBeGreaterThanOrEqual(MIN * 0.9);
    expectTiling(
      patches.map((p) => p.rect),
      TANK,
    );
  });

  it('one tiny holding keeps its own (minimum) patch', () => {
    const patches = layoutTerritory(
      [
        { id: 'big', weight: 1000 },
        { id: 'tiny', weight: 1 },
      ],
      TANK,
      MIN,
      FISH,
    );
    expect(patches[1]).toMatchObject({ ids: ['tiny'], communal: false });
    expect(area(patches[1]!.rect)).toBeGreaterThanOrEqual(MIN * 0.9);
  });

  it('zero total weight means equal shares', () => {
    const patches = layoutTerritory(
      [
        { id: 'a', weight: 0 },
        { id: 'b', weight: 0 },
      ],
      TANK,
      MIN,
      FISH,
    );
    expect(area(patches[0]!.rect)).toBe(area(patches[1]!.rect));
  });

  it('more fish than fit all share the water', () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ id: `f${i}`, weight: 1 }));
    const patches = layoutTerritory(items, TANK, MIN, FISH);
    expect(patches).toHaveLength(1);
    expect(patches[0]!.ids).toHaveLength(60);
  });
});

describe('layout order', () => {
  it('applies the saved order, dropping missing ids and appending new ones', () => {
    expect(applyLayout(['a', 'b', 'c', 'd'], ['c', 'x', 'a'])).toEqual(['c', 'a', 'b', 'd']);
    expect(applyLayout(['a', 'b'], undefined)).toEqual(['a', 'b']);
  });

  it('reorders by dropping onto another patch', () => {
    expect(reorder(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
    expect(reorder(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
    expect(reorder(['a', 'b'], 'a', 'zz')).toEqual(['a', 'b']);
  });
});

describe('minimum patch thickness', () => {
  it('a tiny item still gets a patch at least a fish wide', () => {
    const rects = orderedTreemap([97, 3], TANK, FISH, { w: 40, h: 32 });
    expect(rects[1]!.w).toBeGreaterThanOrEqual(40);
    expectTiling(rects, TANK);
  });
});
