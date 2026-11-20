import { describe, expect, it } from 'vitest';
import { DEFAULT_TANK_VIEW, type Pen, SORT_MODES, normalizeTankView } from '../data/model';
import {
  type ArrangeFish,
  WATER,
  boundsFor,
  columns,
  homeRegions,
  ROOM_PER_FISH,
  overviewRegions,
  sortFish,
  tankGeometry,
  tankZoom,
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

describe('overview groups', () => {
  const school = [
    fish('a', { mood: 'sad', body: 2, value: 500 }),
    fish('b', { mood: 'happy', body: 1, value: 100 }),
    fish('c', { mood: 'happy', body: 1, penId: 'p2', value: 100 }),
    fish('d', { mood: 'ecstatic', body: 6, penId: 'p2', value: 300, symbol: 'A' }),
  ];
  // The pens' own order, pen by pen (p2's layout puts d before c).
  const custom = ['a', 'b', 'd', 'c'];
  const groups = ['mood', 'pen', 'family', 'species', 'together', 'none', 'free'] as const;
  const labelled = (mode: (typeof groups)[number]) =>
    overviewRegions(mode, 'weight', school, pens, custom).filter((r) => r.label);

  it('every grouping places every fish exactly once', () => {
    for (const mode of groups) {
      for (const sort of SORT_MODES) {
        expect(allIds(overviewRegions(mode, sort, school, pens, custom))).toEqual([
          'a',
          'b',
          'c',
          'd',
        ]);
      }
    }
  });

  it('mood: columns from happiest on the left to saddest on the right', () => {
    const regions = labelled('mood');
    expect(regions.map((r) => r.label)).toEqual(['Ecstatic', 'Happy', 'Sad']);
    const xs = regions.map((r) => r.group!.rect.x);
    expect(xs).toEqual([...xs].sort((p, q) => p - q));
    // Happy has two fish, so it's wider.
    expect(regions[1]!.group!.rect.w).toBeGreaterThan(regions[0]!.group!.rect.w);
  });

  it('every label names a group, and the groups cover every fish', () => {
    for (const mode of ['mood', 'species', 'family', 'pen'] as const) {
      const regions = labelled(mode);
      expect(regions.every((r) => r.group)).toBe(true);
      expect(regions.flatMap((r) => r.group!.fishIds).sort()).toEqual(['a', 'b', 'c', 'd']);
    }
  });

  it('gives every fish in a group its own patch inside the group', () => {
    for (const mode of ['mood', 'species', 'family', 'pen'] as const) {
      const regions = overviewRegions(mode, 'weight', school, pens, custom);
      expect(regions.every((r) => r.patch)).toBe(true);
      for (const g of regions.filter((r) => r.group)) {
        const inside = regions.filter((r) =>
          r.fishIds.every((id) => g.group!.fishIds.includes(id)),
        );
        const area = inside.reduce((a, r) => a + r.rect.w * r.rect.h, 0);
        expect(area).toBe(g.group!.rect.w * g.group!.rect.h);
      }
    }
  });

  it('species groups the same ticker from different pens', () => {
    const a = labelled('species').find((r) => r.label === 'A');
    expect(a?.group?.fishIds.sort()).toEqual(['a', 'd']);
  });

  it('family labels by sector family, in family order when sorted by custom', () => {
    const labels = overviewRegions('family', 'custom', school, pens, custom)
      .filter((r) => r.label)
      .map((r) => r.label);
    expect(labels).toEqual(['Tech', 'Finance', 'Health']);
  });

  it('together: kin groups named after their biggest holding, then loners, then the unknown', () => {
    const kin = [
      fish('a', { value: 500, kin: 'kin:B' }),
      fish('b', { value: 100, kin: 'kin:B' }),
      fish('e', { value: 50, kin: 'kin:B', symbol: 'A' }),
      fish('c', { value: 100, kin: 'alone' }),
      fish('d', { value: 300 }),
    ];
    const labels = overviewRegions('together', 'custom', kin, pens)
      .filter((r) => r.label)
      .map((r) => [r.label, r.group!.fishIds.sort()]);
    // A (a + e) is worth more than B; two symbols, so "& 1 more".
    expect(labels).toEqual([
      ['A & 1 more', ['a', 'b', 'e']],
      ['On their own', ['c']],
      ['Too new to tell', ['d']],
    ]);
  });

  it('pen: each pen labelled once, with its own layout inside when sorted by custom', () => {
    const regions = overviewRegions('pen', 'custom', school, pens, custom);
    const pensShown = regions.filter((r) => r.label);
    expect(pensShown.map((r) => [r.label, r.penId])).toEqual([
      ['Taxable', 'p1'],
      ['TFSA', 'p2'],
    ]);
    const tfsa = regions.filter((r) => r.key.startsWith('p2/'));
    expect(tfsa.map((r) => r.fishIds)).toEqual([['d'], ['c']]);
  });

  it('none: every fish its own patch, in sort order', () => {
    expect(overviewRegions('none', 'weight', school, pens, custom)[0]!.fishIds).toEqual(['a']);
    const byName = overviewRegions('none', 'name', school, pens, custom).map((r) => r.fishIds[0]);
    expect(byName).toEqual(['a', 'd', 'b', 'c']); // A, A, B, C: ties keep the custom order
  });

  it('free roam: one region, the whole water', () => {
    expect(overviewRegions('free', 'weight', school, pens)).toEqual([
      expect.objectContaining({ rect: WATER, patch: false }),
    ]);
  });
});

describe('sorting', () => {
  const day = [
    fish('a', { value: 100, change: 0.01, z: 0.5, symbol: 'MSFT' }),
    fish('b', { value: 300, change: -0.02, z: -2.5, symbol: 'AAPL' }),
    fish('c', { value: 200, change: undefined, z: undefined, symbol: 'KO' }),
    fish('d', { value: 50, change: 0.03, z: 3, symbol: 'NVDA' }),
  ];
  const ids = (sort: (typeof SORT_MODES)[number], custom: string[] = []) =>
    sortFish(day, sort, custom).map((f) => f.id);

  it('orders by weight, change, mood and name, highest first', () => {
    expect(ids('weight')).toEqual(['b', 'c', 'a', 'd']);
    expect(ids('change')).toEqual(['d', 'a', 'b', 'c']);
    expect(ids('mood')).toEqual(['d', 'a', 'b', 'c']);
    expect(ids('name')).toEqual(['b', 'c', 'a', 'd']);
  });

  it('puts fish without a price last, in the custom order', () => {
    const nothing = day.map((f) => ({ ...f, change: undefined }));
    expect(sortFish(nothing, 'change', ['d', 'c', 'b', 'a']).map((f) => f.id)).toEqual([
      'd',
      'c',
      'b',
      'a',
    ]);
  });

  it('custom follows the saved order, then the rest as given', () => {
    expect(ids('custom', ['c', 'a'])).toEqual(['c', 'a', 'b', 'd']);
  });

  it('orders groups by the same measure', () => {
    const regions = overviewRegions(
      'pen',
      'change',
      [fish('x', { penId: 'p1', change: -0.01 }), fish('y', { penId: 'p2', change: 0.02 })],
      pens,
    );
    expect(regions.filter((r) => r.label).map((r) => r.label)).toEqual(['TFSA', 'Taxable']);
  });
});

describe('saved views', () => {
  it('reads views saved before grouping and sorting were split', () => {
    expect(normalizeTankView({ pens: 'all', arrange: 'weight' })).toMatchObject({
      group: 'none',
      sort: 'weight',
      homeSort: 'custom',
    });
    expect(normalizeTankView({ pens: ['p1'], arrange: 'family' })).toMatchObject({
      pens: ['p1'],
      group: 'family',
    });
    expect(normalizeTankView(undefined)).toEqual(DEFAULT_TANK_VIEW);
    expect(normalizeTankView({ pens: 'all', group: 'bogus', sort: 'change' })).toMatchObject({
      group: 'mood',
      sort: 'change',
    });
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

describe('zoom', () => {
  // A laptop's tank area at scale 3.
  const box = { w: 1170, h: 690 };
  const zoomFor = (n: number) => tankZoom(box.w, box.h, 3, n);
  const roomPerFish = (z: ReturnType<typeof zoomFor>, n: number) => {
    const { water } = tankGeometry(z.width, z.height);
    return (water.w * water.h) / n;
  };

  it('stays at the normal scale for a full tank', () => {
    expect(zoomFor(20).scale).toBe(3);
  });

  it('zooms in for a few fish, never past twice the normal scale', () => {
    const two = zoomFor(2);
    expect(two.scale).toBeGreaterThan(3);
    expect(two.scale).toBeLessThanOrEqual(6);
    expect(roomPerFish(two, 2)).toBeGreaterThanOrEqual(ROOM_PER_FISH);
  });

  it('zooms out step by step as fish are added, always leaving room for each', () => {
    const scales = [1, 2, 4, 8, 16].map((n) => zoomFor(n).scale);
    expect(scales).toEqual([...scales].sort((a, b) => b - a));
    for (const n of [1, 2, 4, 8]) {
      const z = zoomFor(n);
      if (z.scale > 3) expect(roomPerFish(z, n)).toBeGreaterThanOrEqual(ROOM_PER_FISH);
    }
  });
});
