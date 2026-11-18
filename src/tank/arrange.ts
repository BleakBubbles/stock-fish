/**
 * Where each fish may swim: a single pen's home territory, or an overview
 * arrangement of several pens (docs/SPEC.md, "Organizing fish"). Pure; the
 * scene turns regions into swim bounds and the screen labels them.
 */
import type { ArrangeMode, Pen } from '../data/model';
import { MOODS, type Mood } from '../mood/types';
import { atlasFrames } from '../theme/atlas';
import { FAMILIES } from '../theme/bodies';
import type { Body } from '../theme/sprites';
import { TANK_HEIGHT, TANK_MARGIN_BOTTOM, TANK_MARGIN_TOP, TANK_WIDTH } from './constants';
import { type Patch, type Rect, applyLayout, layoutTerritory, orderedTreemap } from './territory';

export const FISH_SIZE = { w: atlasFrames.frameWidth, h: atlasFrames.frameHeight };

/** The water fish can use. */
export const WATER: Rect = {
  x: 0,
  y: TANK_MARGIN_TOP,
  w: TANK_WIDTH,
  h: TANK_HEIGHT - TANK_MARGIN_TOP - TANK_MARGIN_BOTTOM,
};

/** Smallest patch: a fish plus a little room to swim. */
export const MIN_PATCH: Rect = { x: 0, y: 0, w: FISH_SIZE.w + 8, h: FISH_SIZE.h + 7 };
const MIN_AREA = MIN_PATCH.w * MIN_PATCH.h;

export interface ArrangeFish {
  id: string;
  symbol: string;
  penId: string;
  mood: Mood;
  body: Body;
  /** Market value, if known. */
  value?: number;
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

/** Lay groups out as labelled regions; groups too small for a patch share an "Other" region. */
function groupRegions(groups: Group[]): Region[] {
  const patches = layoutTerritory(
    groups.map((g) => ({ id: g.key, weight: g.weight })),
    WATER,
    MIN_AREA,
    FISH_SIZE,
    MIN_PATCH,
  );
  const byKey = new Map(groups.map((g) => [g.key, g]));
  return patches.map((p) => {
    const members = p.ids.map((k) => byKey.get(k)).filter((g): g is Group => !!g);
    return {
      key: p.communal ? 'other' : (p.ids[0] ?? ''),
      rect: p.rect,
      fishIds: members.flatMap((g) => g.fishIds),
      label: p.communal ? 'Other' : members[0]?.label,
      group: { rect: p.rect, fishIds: members.flatMap((g) => g.fishIds) },
      patch: false,
    };
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
};

/** Regions for an overview of several pens. */
export function overviewRegions(
  mode: ArrangeMode,
  fish: readonly ArrangeFish[],
  pens: readonly Pen[],
): Region[] {
  if (fish.length === 0) return [];
  const w = weights(fish);
  const value = (members: ArrangeFish[]) => members.reduce((a, f) => a + (w.get(f.id) ?? 0), 0);

  switch (mode) {
    case 'free':
      return [{ key: 'all', rect: WATER, fishIds: fish.map((f) => f.id), patch: false }];

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
        WATER,
        MIN_PATCH.w,
      );
      return groups.map((g, i) => ({
        key: g.key,
        rect: rects[i] ?? WATER,
        fishIds: g.fishIds,
        label: g.label,
        group: { rect: rects[i] ?? WATER, fishIds: g.fishIds },
        patch: false,
      }));
    }

    case 'species': {
      const symbols = [...new Set(fish.map((f) => f.symbol))].sort();
      return groupRegions(
        groupBy(
          fish,
          (f) => f.symbol,
          symbols,
          (s) => s,
          value,
        ),
      );
    }

    case 'family': {
      const bodies = FAMILIES.map((f) => f.body);
      return groupRegions(
        groupBy(
          fish,
          (f) => f.body,
          bodies,
          (b) => FAMILY_LABEL[b],
          value,
        ),
      );
    }

    case 'weight': {
      const sorted = [...fish].sort((a, b) => (w.get(b.id) ?? 0) - (w.get(a.id) ?? 0));
      return homeRegions(
        sorted,
        sorted.map((f) => f.id),
      );
    }

    case 'pen': {
      // Each pen's area is sized by its value, with its own home layout inside.
      const groups = groupBy(
        fish,
        (f) => f.penId,
        pens.map((p) => p.id),
        (id) => pens.find((p) => p.id === id)?.name ?? '',
        value,
      );
      const rects = orderedTreemap(
        groups.map((g) => g.weight),
        WATER,
        FISH_SIZE,
        MIN_PATCH,
      );
      return groups.flatMap((g, i) => {
        const rect = rects[i] ?? WATER;
        const members = fish.filter((f) => f.penId === g.key);
        const pen = pens.find((p) => p.id === g.key);
        const inner = homeRegions(members, pen?.layout, rect, `${g.key}/`);
        // The label rides on the pen's first region.
        const group = { rect, fishIds: members.map((f) => f.id) };
        return inner.map((r, j) => (j === 0 ? { ...r, label: g.label, penId: g.key, group } : r));
      });
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
export function boundsFor(rect: Rect): { minX: number; minY: number; maxX: number; maxY: number } {
  const span = (start: number, size: number, fish: number, lo: number, hi: number) => {
    if (size >= fish) return [start, start + size - fish];
    const c = Math.min(hi, Math.max(lo, start + (size - fish) / 2));
    return [c, c];
  };
  const [minX = 0, maxX = 0] = span(rect.x, rect.w, FISH_SIZE.w, 0, TANK_WIDTH - FISH_SIZE.w);
  const [minY = 0, maxY = 0] = span(
    rect.y,
    rect.h,
    FISH_SIZE.h,
    WATER.y,
    WATER.y + WATER.h - FISH_SIZE.h,
  );
  return { minX, minY, maxX, maxY };
}
