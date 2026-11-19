/**
 * The portfolio weather drawn in the tank. Pure, in art pixels: the scene
 * turns these shapes into drawing. Good days, light shafts slant down
 * through the water; bad days, rain streaks down (slanting in a storm), dimples
 * the surface and the water darkens.
 * Calm draws nothing. No lightning or other flashes.
 */
import type { Weather } from '../mood';
import type { Rect } from './territory';
import type { Rand } from './swim';

export interface WeatherLook {
  /** Light shafts from the surface (dimmed with the water at night, like moonlight). */
  shafts: number;
  /** Strength of the shafts at the top; they fade towards the floor. */
  shaftAlpha: number;
  /** Raindrops hitting the surface, per second. */
  rain: number;
  /** Art px a raindrop moves sideways for each art px it falls (the wind). */
  wind: number;
  /** Darkening of the water, 0 to 1. */
  gloom: number;
}

export const WEATHER_LOOK: Record<Weather, WeatherLook> = {
  sunny: { shafts: 5, shaftAlpha: 0.1, rain: 0, wind: 0, gloom: 0 },
  fair: { shafts: 3, shaftAlpha: 0.06, rain: 0, wind: 0, gloom: 0 },
  calm: { shafts: 0, shaftAlpha: 0, rain: 0, wind: 0, gloom: 0 },
  rainy: { shafts: 0, shaftAlpha: 0, rain: 5, wind: 0, gloom: 0.12 },
  stormy: { shafts: 0, shaftAlpha: 0, rain: 16, wind: 0.5, gloom: 0.25 },
};

/** A light shaft's horizontal drift range and period, art px and seconds. */
const SHAFT_DRIFT = 3;
const SHAFT_PERIOD = 11;
/**
 * Shafts fan out from one light above the tank: this share of the way across
 * the water, and this many art px above its surface. Each shaft leans away
 * from the light and widens as it goes down.
 */
export const LIGHT_ACROSS = 0.35;
export const LIGHT_ABOVE = 320;
const SHAFT_WIDTH_MIN = 14;
const SHAFT_WIDTH_MAX = 28;

/** One row of a shaft: whole art pixels, and which fade band it's in (0 top … 2 floor). */
export interface ShaftRow {
  x: number;
  y: number;
  w: number;
  band: 0 | 1 | 2;
}

/** A shaft's fixed character: where it starts, its width and its own phase. */
export interface Shaft {
  x: number;
  w: number;
  phase: number;
}

/** Shafts spread evenly across the water, each a little off its slot. */
export function makeShafts(count: number, water: Rect, rand: Rand): Shaft[] {
  const slot = water.w / Math.max(1, count);
  return Array.from({ length: count }, (_, i) => ({
    x: water.x + slot * i + rand() * slot * 0.5,
    w: SHAFT_WIDTH_MIN + Math.floor(rand() * (SHAFT_WIDTH_MAX - SHAFT_WIDTH_MIN + 1)),
    phase: rand() * Math.PI * 2,
  }));
}

/**
 * The rows of every shaft at time `t`: a staircase fanning out from the light
 * above (leaning away from it and widening downwards), drifting slowly side
 * to side by whole pixels, clipped to the water.
 */
export function shaftRows(shafts: readonly Shaft[], water: Rect, t: number): ShaftRow[] {
  const rows: ShaftRow[] = [];
  const right = water.x + water.w;
  const lightX = water.x + water.w * LIGHT_ACROSS;
  for (const s of shafts) {
    const drift = Math.round(Math.sin((t / SHAFT_PERIOD) * Math.PI * 2 + s.phase) * SHAFT_DRIFT);
    const breathe = Math.round(Math.sin((t / SHAFT_PERIOD) * Math.PI * 4 + s.phase));
    const w = s.w + breathe;
    const centre = s.x + drift + w / 2;
    // Seen from the light: a line through it and the shaft's centre at the surface.
    const slope = (centre - lightX) / LIGHT_ABOVE;
    for (let dy = 0; dy < water.h; dy++) {
      const spread = 1 + dy / LIGHT_ABOVE;
      const width = Math.round(w * spread);
      const x0 = Math.round(centre + dy * slope - width / 2);
      const x = Math.max(water.x, x0);
      const end = Math.min(right, x0 + width);
      if (end <= x) continue;
      const band = dy < water.h / 3 ? 0 : dy < (water.h * 2) / 3 ? 1 : 2;
      rows.push({ x, y: water.y + dy, w: end - x, band });
    }
  }
  return rows;
}

/** A falling raindrop: its streak's lowest pixel, and how fast it falls (art px/s). */
export interface Drop {
  x: number;
  y: number;
  speed: number;
}

/** Raindrop fall speeds, art px/s, and streak length, art px. */
const DROP_SPEED_MIN = 70;
const DROP_SPEED_MAX = 110;
export const DROP_LENGTH = 3;

/**
 * Move the drops down (and sideways with the wind), drop those that reached
 * the floor, and let new ones in at the surface: each new drop also starts a
 * ripple where it lands.
 */
export function stepRain(
  drops: readonly Drop[],
  ripples: readonly Ripple[],
  dt: number,
  look: Pick<WeatherLook, 'rain' | 'wind'>,
  water: Rect,
  rand: Rand,
): { drops: Drop[]; ripples: Ripple[] } {
  const bottom = water.y + water.h;
  const moved = drops.flatMap((d) => {
    const fall = d.speed * dt;
    const next = { ...d, y: d.y + fall, x: d.x + fall * look.wind };
    return next.y < bottom ? [next] : [];
  });
  const nextRipples = stepRipples(ripples, dt, look.rain, water, rand);
  // stepRipples keeps the surviving ripples first; the rest are drops landing now,
  // which fall on through the water from there.
  const surviving = ripples.filter((r) => r.age + dt < RIPPLE_LIFE).length;
  for (const r of nextRipples.slice(surviving)) {
    moved.push({
      x: r.x,
      y: water.y + 1,
      speed: DROP_SPEED_MIN + rand() * (DROP_SPEED_MAX - DROP_SPEED_MIN),
    });
  }
  return { drops: moved, ripples: nextRipples };
}

/** A drop's streak: DROP_LENGTH pixels up from its lowest one, leaning into the wind. */
export function dropPixels(d: Drop, wind: number, water: Rect): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < DROP_LENGTH; i++) {
    const x = Math.round(d.x - i * wind);
    const y = Math.round(d.y) - i;
    if (y >= water.y && y < water.y + water.h && x >= water.x && x < water.x + water.w) {
      out.push({ x, y });
    }
  }
  return out;
}

/** A raindrop's ring on the surface: grows from its centre, then fades. */
export interface Ripple {
  x: number;
  age: number;
}

/** How long a ripple lasts, seconds, and how wide it grows, art px. */
export const RIPPLE_LIFE = 0.6;
export const RIPPLE_WIDTH = 9;

/** Age the ripples and add new drops at `rate` per second. */
export function stepRipples(
  ripples: readonly Ripple[],
  dt: number,
  rate: number,
  water: Rect,
  rand: Rand,
): Ripple[] {
  const out = ripples.flatMap((r) => (r.age + dt < RIPPLE_LIFE ? [{ ...r, age: r.age + dt }] : []));
  // Expected rate × dt drops this step; whole drops plus a chance of one more.
  let drops = rate * dt;
  while (drops > 0) {
    if (drops >= 1 || rand() < drops) {
      out.push({ x: water.x + rand() * water.w, age: 0 });
    }
    drops -= 1;
  }
  return out;
}

/**
 * A ripple's pixels at the surface: a dimple at the centre that spreads into
 * two arcs moving apart, on the top row of the water and the row under it.
 */
export function ripplePixels(r: Ripple, water: Rect): { x: number; y: number }[] {
  const t = r.age / RIPPLE_LIFE;
  const reach = Math.round(t * ((RIPPLE_WIDTH - 1) / 2));
  const cx = Math.round(r.x);
  const px =
    reach === 0
      ? [
          { x: cx, y: water.y },
          { x: cx, y: water.y + 1 },
        ]
      : [
          { x: cx - reach, y: water.y },
          { x: cx + reach, y: water.y },
          { x: cx - reach + 1, y: water.y + 1 },
          { x: cx + reach - 1, y: water.y + 1 },
        ];
  return px.filter((p) => p.x >= water.x && p.x < water.x + water.w);
}
