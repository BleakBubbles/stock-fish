import { describe, expect, it } from 'vitest';
import type { Pen } from '../data/model';
import {
  type ArrangeFish,
  WATER,
  boundsFor,
  columns,
  homeRegions,
  overviewRegions,
  weights,
} from './arrange';

const fish = (id: string, over: Partial<ArrangeFish> = {}): ArrangeFish => ({
  id,
  symbol: id.toUpperCase(),
  penId: 'p1',
  mood: 'neutral',
  body: 1,
  value: 100,
  ...over,
});

const pens: Pen[] = [
  { id: 'p1', name: 'Taxable', createdAt: 1 },
  { id: 'p2', name: 'TFSA', createdAt: 2, layout: ['d', 'c'] },
];

const allIds = (regions: { fishIds: string[] }[]) => regions.flatMap((r) => r.fishIds).sort();

describe('weights', () => {
  it('fills unknown values with the median of the known ones', () => {
    const w = weights([
      fish('a', { value: 10 }),
      fish('b', { value: 30 }),
      fish('c', { value: undefined }),
    ]);
    expect(w.get('c')).toBe(30);
  });
});

describe('home', () => {
  it('follows the saved layout order', () => {
    const regions = homeRegions([fish('a'), fish('b')], ['b', 'a']);
    expect(regions.map((r) => r.fishIds)).toEqual([['b'], ['a']]);
    expect(regions.every((r) => r.patch)).toBe(true);
  });
});

describe('overview modes', () => {
  const school = [
    fish('a', { mood: 'sad', body: 2, value: 500 }),
    fish('b', { mood: 'happy', body: 1, value: 100 }),
    fish('c', { mood: 'happy', body: 1, penId: 'p2', value: 100 }),
    fish('d', { mood: 'ecstatic', body: 6, penId: 'p2', value: 300, symbol: 'A' }),
  ];

  it('every mode places every fish exactly once', () => {
    for (const mode of ['mood', 'species', 'family', 'weight', 'pen', 'free'] as const) {
      expect(allIds(overviewRegions(mode, school, pens))).toEqual(['a', 'b', 'c', 'd']);
    }
  });

  it('mood: columns from happiest on the left to saddest on the right', () => {
    const regions = overviewRegions('mood', school, pens);
    expect(regions.map((r) => r.label)).toEqual(['Ecstatic', 'Happy', 'Sad']);
    const xs = regions.map((r) => r.rect.x);
    expect(xs).toEqual([...xs].sort((p, q) => p - q));
    // Happy has two fish, so it's wider.
    expect(regions[1]!.rect.w).toBeGreaterThan(regions[0]!.rect.w);
  });

  it('every label names a group, and the groups cover every fish', () => {
    for (const mode of ['mood', 'species', 'family', 'pen'] as const) {
      const labelled = overviewRegions(mode, school, pens).filter((r) => r.label);
      expect(labelled.every((r) => r.group)).toBe(true);
      expect(labelled.flatMap((r) => r.group!.fishIds).sort()).toEqual(['a', 'b', 'c', 'd']);
    }
  });

  it('species groups the same ticker from different pens', () => {
    const regions = overviewRegions('species', school, pens);
    const a = regions.find((r) => r.label === 'A');
    expect(a?.fishIds.sort()).toEqual(['a', 'd']);
  });

  it('family labels by sector family', () => {
    const labels = overviewRegions('family', school, pens).map((r) => r.label);
    expect(labels).toEqual(['Tech', 'Finance', 'Health']);
  });

  it('pen: each pen labelled once, with its own layout inside', () => {
    const regions = overviewRegions('pen', school, pens);
    const labelled = regions.filter((r) => r.label);
    // The label's group is the whole pen, across its patches.
    expect(labelled[1]!.group?.fishIds.sort()).toEqual(['c', 'd']);
    const tfsaArea = regions
      .filter((r) => r.key.startsWith('p2/'))
      .reduce((a, r) => a + r.rect.w * r.rect.h, 0);
    const g = labelled[1]!.group!.rect;
    expect(g.w * g.h).toBe(tfsaArea);
    expect(labelled.map((r) => [r.label, r.penId])).toEqual([
      ['Taxable', 'p1'],
      ['TFSA', 'p2'],
    ]);
    const tfsa = regions.filter((r) => r.key.startsWith('p2/'));
    expect(tfsa.map((r) => r.fishIds)).toEqual([['d'], ['c']]);
  });

  it('weight: biggest first', () => {
    expect(overviewRegions('weight', school, pens)[0]!.fishIds).toEqual(['a']);
  });

  it('free roam: one region, the whole water', () => {
    expect(overviewRegions('free', school, pens)).toEqual([
      expect.objectContaining({ rect: WATER, patch: false }),
    ]);
  });
});

describe('geometry', () => {
  it('columns keep a minimum width when they fit', () => {
    const rs = columns([1, 10], { x: 0, y: 0, w: 320, h: 10 }, 40);
    expect(rs[0]!.w).toBeGreaterThanOrEqual(40);
    expect(rs[0]!.w + rs[1]!.w).toBe(320);
  });

  it('columns tile the rect exactly', () => {
    const rs = columns([1, 2, 1], { x: 0, y: 0, w: 321, h: 10 });
    expect(rs.map((r) => r.w).reduce((a, b) => a + b)).toBe(321);
    expect(rs[2]!.x + rs[2]!.w).toBe(321);
  });

  it('bounds keep the whole fish inside the region', () => {
    expect(boundsFor({ x: 10, y: 20, w: 100, h: 50 })).toEqual({
      minX: 10,
      minY: 20,
      maxX: 78,
      maxY: 45,
    });
  });

  it('a region narrower than a fish centres it, but never outside the water', () => {
    const b = boundsFor({ x: 0, y: WATER.y, w: 20, h: WATER.h });
    expect(b.minX).toBe(WATER.x);
    expect(b.maxX).toBe(WATER.x);
  });
});
