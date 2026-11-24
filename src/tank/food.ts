/**
 * Feeding (docs/SPEC.md, "Care and the daily visit"): food sprinkled at the
 * surface sinks to the sand, and sharks swim up to it and eat. Pure: art
 * pixels and seconds, no PixiJS.
 */
import type { Rect } from './territory';
import type { Rand, SwimState } from './swim';

/** One food pellet, an art pixel. */
export interface Pellet {
  x: number;
  y: number;
  /** Seconds before it drops in (pellets land one after another). */
  delay: number;
  /** Seconds it has lain on the sand. */
  rest: number;
  /** The sharks it's for: those being fed, not yet fed today. Only they come up to eat. */
  for: readonly string[];
}

/** Sinking speed, art pixels per second. */
const SINK = 5;
/** Pellets on the sand vanish after this long uneaten. */
const REST_LIFE = 8;
/** How long the sprinkle takes, from the first pellet to the last. */
const SPRINKLE_TIME = 1.2;
/** Pellets land within this many pixels either side of the tap. */
const SPREAD = 8;

/** A sprinkle of `count` pellets at the surface over `x`, for the sharks `forIds`. */
export function sprinkle(
  x: number,
  count: number,
  water: Rect,
  rand: Rand,
  forIds: readonly string[],
): Pellet[] {
  const lo = water.x + 1;
  const hi = water.x + water.w - 2;
  return Array.from({ length: count }, () => ({
    x: Math.round(Math.min(hi, Math.max(lo, x + (rand() * 2 - 1) * SPREAD))),
    y: water.y + 1,
    delay: rand() * SPRINKLE_TIME,
    rest: 0,
    for: forIds,
  }));
}

/** The pellets a shark may eat: those meant for it. */
export function foodFor(pellets: readonly Pellet[], id: string): Pellet[] {
  return pellets.filter((p) => p.for.includes(id));
}

/** Pellets after `dt` seconds: sinking to `floor` (the top of the sand), then fading. */
export function stepPellets(pellets: readonly Pellet[], dt: number, floor: number): Pellet[] {
  return pellets.flatMap((p) => {
    if (p.delay > 0) return [{ ...p, delay: Math.max(0, p.delay - dt) }];
    if (p.y < floor) return [{ ...p, y: Math.min(floor, p.y + SINK * dt) }];
    return p.rest + dt < REST_LIFE ? [{ ...p, rest: p.rest + dt }] : [];
  });
}

/** Pellets in the water (dropped in, not still waiting). */
export function landed(pellets: readonly Pellet[]): Pellet[] {
  return pellets.filter((p) => p.delay <= 0);
}

/** Where a shark's mouth is: near its nose, wherever it faces. */
export const MOUTH = { front: 28, back: 3, y: 13 } as const;

export function mouthOf(swim: Pick<SwimState, 'x' | 'y' | 'facing'>): { x: number; y: number } {
  return {
    x: swim.x + (swim.facing === 1 ? MOUTH.front : MOUTH.back),
    y: swim.y + MOUTH.y,
  };
}

/** The pellet nearest a point, if any. */
export function nearest(
  pellets: readonly Pellet[],
  at: { x: number; y: number },
): Pellet | undefined {
  let best: Pellet | undefined;
  let bestD = Infinity;
  for (const p of pellets) {
    const d = Math.hypot(p.x - at.x, p.y - at.y);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

/**
 * Where a shark should swim so its mouth meets a pellet: facing the pellet,
 * from whichever side it's on.
 */
export function approach(
  swim: Pick<SwimState, 'x' | 'y'>,
  pellet: Pellet,
  width: number,
): { targetX: number; targetY: number; facing: 1 | -1 } {
  const right = pellet.x >= swim.x + width / 2;
  return {
    targetX: pellet.x - (right ? MOUTH.front : MOUTH.back),
    targetY: pellet.y - MOUTH.y,
    // Faces the food whichever side it's on, even when barely moving sideways to reach it.
    facing: right ? 1 : -1,
  };
}

/** Close enough to eat. */
export const BITE = 2.5;
