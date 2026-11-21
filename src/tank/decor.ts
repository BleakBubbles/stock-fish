/**
 * Where each tank's decor goes: the sand's surface, specks in the sand, and
 * plants and rocks along the floor. Pure and seeded, so a tank always looks
 * the same (each pen has its own seed; overviews share one).
 */
import { fnv1a } from '../theme';
import type { Rect } from './territory';

export interface DecorSize {
  name: string;
  w: number;
  h: number;
  /** Has a swaying frame. */
  sway: boolean;
}

export interface DecorPlacement {
  name: string;
  /** Top-left, in art pixels. */
  x: number;
  y: number;
  sway: boolean;
  /** Drawn in front of the sand's edge (rocks, grass), else behind it. */
  front: boolean;
  /** Seconds into the sway cycle at time zero, so plants don't sway in step. */
  phase: number;
}

export interface DecorLayout {
  /** The first sand row of each column, from `water.x` across. */
  sandTops: number[];
  /** Darker specks in the sand. */
  specks: { x: number; y: number }[];
  items: DecorPlacement[];
}

/** A small, fast seeded random number generator (mulberry32): 0 ≤ n < 1. */
export function seededRandom(seed: string): () => number {
  let a = fnv1a(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Kinds of decor, by name prefix: how many of each a tank gets, and whether they stand in front. */
const KINDS: { prefix: string; count: [number, number]; front: boolean; sink: number }[] = [
  { prefix: 'sword', count: [1, 2], front: false, sink: 2 },
  { prefix: 'kelp', count: [2, 3], front: false, sink: 2 },
  { prefix: 'rock', count: [2, 3], front: true, sink: 3 },
  { prefix: 'grass', count: [2, 3], front: true, sink: 2 },
];

/** How far the sand's surface rises and falls around its average line. */
export const SAND_WAVE = 2;
const SPECKS_PER_COLUMN = 0.22;
/** Art pixels kept clear between items, and from the glass. */
const GAP = 2;
/** Length of one sway cycle (still, then swayed), in seconds. */
export const SWAY_PERIOD = 1.8;

/**
 * Lay out one tank's floor. `water` is the water inside the frame; `sandTop`
 * the average first row of sand; `sizes` the decor items available.
 */
export function decorLayout(
  seed: string,
  water: Rect,
  sandTop: number,
  sizes: readonly DecorSize[],
): DecorLayout {
  const rand = seededRandom(seed);
  const bottom = water.y + water.h;

  const p1 = rand() * Math.PI * 2;
  const p2 = rand() * Math.PI * 2;
  const sandTops = Array.from({ length: water.w }, (_, i) => {
    const wave = 1.3 * Math.sin(i / 23 + p1) + 0.8 * Math.sin(i / 9 + p2);
    return sandTop + Math.max(-SAND_WAVE, Math.min(SAND_WAVE, Math.round(wave)));
  });

  const specks: { x: number; y: number }[] = [];
  const speckCount = Math.round(water.w * SPECKS_PER_COLUMN);
  for (let i = 0; i < speckCount; i++) {
    const col = Math.floor(rand() * water.w);
    const top = (sandTops[col] ?? sandTop) + 2;
    if (top >= bottom) continue;
    specks.push({ x: water.x + col, y: top + Math.floor(rand() * (bottom - top)) });
  }

  const items: DecorPlacement[] = [];
  const used: [number, number][] = [];
  const minX = water.x + GAP;
  const maxRight = water.x + water.w - GAP;
  for (const kind of KINDS) {
    const options = sizes.filter((s) => s.name.startsWith(`${kind.prefix}-`));
    if (!options.length) continue;
    const [lo, hi] = kind.count;
    const count = lo + Math.floor(rand() * (hi - lo + 1));
    for (let n = 0; n < count; n++) {
      const size = options[Math.floor(rand() * options.length)];
      if (!size) continue;
      for (let attempt = 0; attempt < 40; attempt++) {
        const span = maxRight - size.w - minX;
        if (span < 0) break;
        const x = minX + Math.floor(rand() * (span + 1));
        const right = x + size.w;
        if (used.some(([a, b]) => right + GAP > a && x < b + GAP)) continue;
        used.push([x, right]);
        const cols = sandTops.slice(x - water.x, right - water.x);
        const ground = Math.min(...cols) + kind.sink;
        items.push({
          name: size.name,
          x,
          y: ground - size.h,
          sway: size.sway,
          front: kind.front,
          phase: rand() * SWAY_PERIOD,
        });
        break;
      }
    }
  }
  return { sandTops, specks, items };
}
