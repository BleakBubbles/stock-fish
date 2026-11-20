/**
 * Where each fish may swim: a single pen's home territory, or an overview
 * arrangement of several pens (docs/SPEC.md, "Organizing fish"). Pure; the
 * scene turns regions into swim bounds and the screen labels them.
 */
import type { GroupMode, Pen, SortMode } from '../data/model';
import { MOODS, type Mood } from '../mood/types';
import { atlasFrames } from '../theme/atlas';
import { FAMILIES } from '../theme/bodies';
import type { Body } from '../theme/sprites';
import {
  FRAME,
  MAX_ZOOM,
  MIN_ZOOMED_TANK,
  SAND_DEPTH,
  SAND_OVERLAP,
  TANK_HEIGHT,
  TANK_WIDTH,
  tankSize,
} from './constants';
import { type Patch, type Rect, applyLayout, layoutTerritory, orderedTreemap } from './territory';

export const FISH_SIZE = { w: atlasFrames.frameWidth, h: atlasFrames.frameHeight };

/** A tank of some size: its frame's inside, sand line and swimming water, in art pixels. */
export interface TankGeometry {
  width: number;
  height: number;
  /** All the water inside the tank frame, sand included. */
  inner: Rect;
  /** The average sand line: the first art row of sand. */
  sandTop: number;
  /** The water fish can use: inside the frame, below the lid, down to the sand. */
  water: Rect;
}

export function tankGeometry(width: number, height: number): TankGeometry {
  const inner = {
    x: FRAME.side,
    y: FRAME.lid,
    w: width - 2 * FRAME.side,
    h: height - FRAME.lid - FRAME.bottom,
  };
  const sandTop = inner.y + inner.h - SAND_DEPTH;
  const water = {
    x: inner.x,
    y: inner.y + 1,
    w: inner.w,
    h: sandTop + SAND_OVERLAP - (inner.y + 1),
  };
  return { width, height, inner, sandTop, water };
}

/** The reference tank (320 × 180): the default for layouts until the real size is known. */
export const DEFAULT_GEOMETRY = tankGeometry(TANK_WIDTH, TANK_HEIGHT);
export const INNER_WATER: Rect = DEFAULT_GEOMETRY.inner;
export const SAND_TOP = DEFAULT_GEOMETRY.sandTop;
export const WATER: Rect = DEFAULT_GEOMETRY.water;

/** Smallest patch: a fish plus a little room to swim. */
export const MIN_PATCH: Rect = { x: 0, y: 0, w: FISH_SIZE.w + 8, h: FISH_SIZE.h + 7 };
const MIN_AREA = MIN_PATCH.w * MIN_PATCH.h;

/**
 * Water each fish should have before the tank zooms in: a few smallest
 * patches' worth, so uneven holdings still each get a patch of their own.
 */
export const ROOM_PER_FISH = 4 * MIN_AREA;

/**
 * The tank's size and scale for a box of device pixels holding `fishCount`
 * fish: zoomed in (a bigger whole-number scale, so fewer, bigger art pixels)
 * as far as every fish keeps ROOM_PER_FISH of water, up to MAX_ZOOM times the
 * normal scale. A full tank stays at the normal scale.
 */
export function tankZoom(
  boxWidth: number,
  boxHeight: number,
  baseScale: number,
  fishCount: number,
): { scale: number; width: number; height: number } {
  const base = tankSize(boxWidth, boxHeight, baseScale);
  const n = Math.max(1, fishCount);
  for (let scale = Math.floor(base.scale * MAX_ZOOM); scale > base.scale; scale--) {
    const size = tankSize(boxWidth, boxHeight, scale, MIN_ZOOMED_TANK);
    if (size.scale !== scale) continue;
    const { water } = tankGeometry(size.width, size.height);
    if ((water.w * water.h) / n >= ROOM_PER_FISH) return size;
  }
  return base;
}

export interface ArrangeFish {
  id: string;
  symbol: string;
  penId: string;
  mood: Mood;
  body: Body;
  /** Market value, if known. */
  value?: number;
  /** Today's return, if known (for sorting). */
  change?: number;
  /** Today's move in typical days (σ), if known (for sorting by mood). */
  z?: number;
}

export interface Region {
  key: string;
  rect: Rect;
  fishIds: string[];
  /** Group name, shown over the region in overview modes. */
  label?: string;
  /**
   * On a labelled region: the whole group it names (in Pen mode a pen spans
   * several patches). Tapping the label outlines `rect` and sums `fishIds`.
   */
  group?: { rect: Rect; fishIds: string[] };
  /** In Pen mode, the pen this label names. */
  penId?: string;
  /** A fish's own territory (or the communal one): outlined when its fish is selected. */
  patch: boolean;
}

/** Fish values with unknown ones filled in (median of the known, else 1), so every fish gets space. */
export function weights(fish: readonly ArrangeFish[]): Map<string, number> {
  const known = fish
    .map((f) => f.value)
    .filter((v): v is number => v !== undefined && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  const fallback = known.length ? (known[Math.floor(known.length / 2)] ?? 1) : 1;
  return new Map(
    fish.map((f) => [
      f.id,
      f.value !== undefined && Number.isFinite(f.value) && f.value > 0 ? f.value : fallback,
    ]),
  );
}

function patchRegions(patches: Patch[], prefix: string): Region[] {
  return patches.map((p) => ({
    key: `${prefix}${p.communal ? 'communal' : (p.ids[0] ?? '')}`,
    rect: p.rect,
    fishIds: p.ids,
    patch: true,
  }));
}

/** A pen's home: territory in the user's order. */
export function homeRegions(
  fish: readonly ArrangeFish[],
  layout: readonly string[] | undefined,
  rect: Rect = WATER,
  prefix = '',
): Region[] {
  const w = weights(fish);
  const order = applyLayout(
    fish.map((f) => f.id),
    layout,
  );
  return patchRegions(
    layoutTerritory(
      order.map((id) => ({ id, weight: w.get(id) ?? 1 })),
      rect,
      MIN_AREA,
      FISH_SIZE,
      MIN_PATCH,
    ),
    prefix,
  );
}

interface Group {
  key: string;
  label: string;
  fishIds: string[];
  weight: number;
}

/**
 * Lay groups out as labelled areas filled with their fish's patches; groups
 * too small for a patch share an "Other" area.
 */
function groupRegions(
  groups: Group[],
  fish: readonly ArrangeFish[],
  sort: SortMode,
  custom: readonly string[],
  water: Rect,
): Region[] {
  const patches = layoutTerritory(
    groups.map((g) => ({ id: g.key, weight: g.weight })),
    water,
    MIN_AREA,
    FISH_SIZE,
    MIN_PATCH,
  );
  const byKey = new Map(groups.map((g) => [g.key, g]));
  return patches.flatMap((p) => {
    const members = p.ids.map((k) => byKey.get(k)).filter((g): g is Group => !!g);
    const g: Group = {
      key: p.communal ? 'other' : (p.ids[0] ?? ''),
      label: p.communal ? 'Other' : (members[0]?.label ?? ''),
      fishIds: members.flatMap((m) => m.fishIds),
      weight: members.reduce((a, m) => a + m.weight, 0),
    };
    return groupWithPatches(g, p.rect, fish, sort, custom);
  });
}

function groupBy<K>(
  fish: readonly ArrangeFish[],
  keyOf: (f: ArrangeFish) => K,
  order: readonly K[],
  labelOf: (k: K) => string,
  weightOf: (members: ArrangeFish[]) => number,
): Group[] {
  return order.flatMap((k) => {
    const members = fish.filter((f) => keyOf(f) === k);
    return members.length
      ? [
          {
            key: String(k),
            label: labelOf(k),
            fishIds: members.map((f) => f.id),
            weight: weightOf(members),
          },
        ]
      : [];
  });
}

const MOOD_LABEL: Record<Mood, string> = {
  ecstatic: 'Ecstatic',
  happy: 'Happy',
  neutral: 'Calm',
  uneasy: 'Uneasy',
  sad: 'Sad',
};

const FAMILY_LABEL: Record<Body, string> = {
  1: 'Tech',
  2: 'Finance',
  3: 'Consumer',
  4: 'Energy',
  5: 'Industrial',
  6: 'Health',
  7: 'Fund',
  8: 'Crypto',
};

/** Fish in `sort` order. Unknown values go last; ties keep the custom order. */
export function sortFish(
  fish: readonly ArrangeFish[],
  sort: SortMode,
  custom: readonly string[] = [],
): ArrangeFish[] {
  const rank = new Map(
    applyLayout(
      fish.map((f) => f.id),
      custom,
    ).map((id, i) => [id, i]),
  );
  const byCustom = (a: ArrangeFish, b: ArrangeFish) =>
    (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0);
  const w = weights(fish);
  // Highest first; missing or unusable numbers sink to the end.
  const desc = (of: (f: ArrangeFish) => number | undefined) => (a: ArrangeFish, b: ArrangeFish) => {
    const x = of(a);
    const y = of(b);
    const okX = x !== undefined && Number.isFinite(x);
    const okY = y !== undefined && Number.isFinite(y);
    if (okX && okY && x !== y) return y - x;
    if (okX !== okY) return okX ? -1 : 1;
    return byCustom(a, b);
  };
  const compare: Record<SortMode, (a: ArrangeFish, b: ArrangeFish) => number> = {
    custom: byCustom,
    weight: desc((f) => w.get(f.id)),
    change: desc((f) => f.change),
    mood: desc((f) => f.z),
    name: (a, b) => a.symbol.localeCompare(b.symbol) || byCustom(a, b),
  };
  return [...fish].sort(compare[sort]);
}

/** Order groups by the same measure as their fish (custom keeps their natural order). */
function sortGroups(groups: Group[], sort: SortMode, fish: readonly ArrangeFish[]): Group[] {
  if (sort === 'custom') return groups;
  if (sort === 'name') return [...groups].sort((a, b) => a.label.localeCompare(b.label));
  const byId = new Map(fish.map((f) => [f.id, f]));
  const w = weights(fish);
  const pick = (f: ArrangeFish) => (sort === 'change' ? f.change : f.z);
  const score = (g: Group): number | undefined => {
    if (sort === 'weight') return g.weight;
    // Value-weighted change, or mean z, over the members that have one.
    const known = g.fishIds.flatMap((id) => {
      const f = byId.get(id);
      return f && Number.isFinite(pick(f)) ? [f] : [];
    });
    if (!known.length) return undefined;
    if (sort === 'mood') return known.reduce((a, f) => a + (pick(f) ?? 0), 0) / known.length;
    const total = known.reduce((a, f) => a + (w.get(f.id) ?? 0), 0);
    return known.reduce((a, f) => a + (pick(f) ?? 0) * (w.get(f.id) ?? 0), 0) / (total || 1);
  };
  return groups
    .map((g, i) => ({ g, s: score(g), i }))
    .sort((a, b) => {
      const okA = a.s !== undefined;
      const okB = b.s !== undefined;
      if (okA && okB && a.s !== b.s) return (b.s ?? 0) - (a.s ?? 0);
      if (okA !== okB) return okA ? -1 : 1;
      return a.i - b.i;
    })
    .map((x) => x.g);
}

/**
 * A group's area filled with its fish's patches in sort order; the group's
 * label rides on its first patch.
 */
function groupWithPatches(
  g: Group,
  rect: Rect,
  fish: readonly ArrangeFish[],
  sort: SortMode,
  custom: readonly string[],
  extra: Partial<Region> = {},
): Region[] {
  const ids = new Set(g.fishIds);
  const members = fish.filter((f) => ids.has(f.id));
  const order = sortFish(members, sort, custom).map((f) => f.id);
  const inner = homeRegions(members, order, rect, `${g.key}/`);
  const group = { rect, fishIds: g.fishIds };
  return inner.map((r, j) => (j === 0 ? { ...r, label: g.label, group, ...extra } : r));
}

/**
 * Regions for an overview of several pens: fish grouped by `group` (or not),
 * each group's area sized by its weight, and every fish's patch placed in
 * `sort` order. `custom` is the user's own order (the pens' layouts, pen by pen).
 */
export function overviewRegions(
  group: GroupMode,
  sort: SortMode,
  fish: readonly ArrangeFish[],
  pens: readonly Pen[],
  custom: readonly string[] = [],
  water: Rect = WATER,
): Region[] {
  if (fish.length === 0) return [];
  const w = weights(fish);
  const value = (members: ArrangeFish[]) => members.reduce((a, f) => a + (w.get(f.id) ?? 0), 0);

  switch (group) {
    case 'free':
      return [{ key: 'all', rect: water, fishIds: fish.map((f) => f.id), patch: false }];

    case 'none': {
      const order = sortFish(fish, sort, custom);
      return homeRegions(
        order,
        order.map((f) => f.id),
        water,
      );
    }

    case 'mood': {
      // Columns left to right, happiest first, sized by how many fish are in each.
      const groups = groupBy(
        fish,
        (f) => f.mood,
        MOODS,
        (m) => MOOD_LABEL[m],
        (m) => m.length,
      );
      const rects = columns(
        groups.map((g) => g.weight),
        water,
        MIN_PATCH.w,
      );
      return groups.flatMap((g, i) => groupWithPatches(g, rects[i] ?? water, fish, sort, custom));
    }

    case 'species':
    case 'family': {
      const groups =
        group === 'species'
          ? groupBy(
              fish,
              (f) => f.symbol,
              [...new Set(fish.map((f) => f.symbol))].sort(),
              (s) => s,
              value,
            )
          : groupBy(
              fish,
              (f) => f.body,
              FAMILIES.map((f) => f.body),
              (b) => FAMILY_LABEL[b],
              value,
            );
      return groupRegions(sortGroups(groups, sort, fish), fish, sort, custom, water);
    }

    case 'pen': {
      // Each pen's area is sized by its value, with its fish's patches inside.
      const groups = sortGroups(
        groupBy(
          fish,
          (f) => f.penId,
          pens.map((p) => p.id),
          (id) => pens.find((p) => p.id === id)?.name ?? '',
          value,
        ),
        sort,
        fish,
      );
      const rects = orderedTreemap(
        groups.map((g) => g.weight),
        water,
        FISH_SIZE,
        MIN_PATCH,
      );
      return groups.flatMap((g, i) =>
        groupWithPatches(g, rects[i] ?? water, fish, sort, custom, { penId: g.key }),
      );
    }
  }
}

/**
 * Side-by-side columns sized by weight, each at least `minWidth` wide (when
 * they all fit; otherwise equal widths).
 */
export function columns(weights: readonly number[], rect: Rect, minWidth = 0): Rect[] {
  const total = weights.reduce((a, b) => a + b, 0);
  const spare = rect.w - minWidth * weights.length;
  const widths = weights.map((wt) =>
    spare < 0 || total <= 0 ? rect.w / weights.length : minWidth + (spare * wt) / total,
  );
  let x = rect.x;
  let acc = 0;
  return widths.map((wd, i) => {
    acc += wd;
    const end = i === widths.length - 1 ? rect.x + rect.w : rect.x + Math.round(acc);
    const r = { x, y: rect.y, w: end - x, h: rect.h };
    x = end;
    return r;
  });
}

/** Swim bounds (a fish's top-left corner) for a region; centred if the region is smaller than a fish. */
export function boundsFor(
  rect: Rect,
  water: Rect = WATER,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const span = (start: number, size: number, fish: number, lo: number, hi: number) => {
    if (size >= fish) return [start, start + size - fish];
    const c = Math.min(hi, Math.max(lo, start + (size - fish) / 2));
    return [c, c];
  };
  const [minX = 0, maxX = 0] = span(
    rect.x,
    rect.w,
    FISH_SIZE.w,
    water.x,
    water.x + water.w - FISH_SIZE.w,
  );
  const [minY = 0, maxY = 0] = span(
    rect.y,
    rect.h,
    FISH_SIZE.h,
    water.y,
    water.y + water.h - FISH_SIZE.h,
  );
  return { minX, minY, maxX, maxY };
}
