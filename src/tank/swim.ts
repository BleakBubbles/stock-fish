/**
 * Fish movement in art pixels. Pure: positions are floats here and get
 * rounded to whole art pixels only when drawn (CLAUDE.md, firm rule 4).
 * Fish wander between random targets, pause, and face where they're going.
 * How they wander depends on their temperament (src/mood/temperament.ts):
 * calm fish glide slowly over long distances and rest a while, jittery fish
 * dart quickly a short way and hardly stop.
 */
import { DEFAULT_TEMPER } from '../mood/temperament';

/** Allowed area for a fish's top-left corner. */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SwimState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  /** Art pixels per second. */
  speed: number;
  /** 1 = facing right (as drawn), −1 = mirrored. */
  facing: 1 | -1;
  /** Seconds left to idle before picking a new target. */
  pause: number;
  /** Swimming out of the tank to be removed (a sold holding). */
  leaving: boolean;
  /** Heading to a new region (a rearrangement): swims faster, no pause, until it arrives. */
  hurry?: boolean;
  /** Temperament, 0 (calm) to 1 (jittery); DEFAULT_TEMPER when missing. */
  temper?: number;
}

export type Rand = () => number;

/** How a fish of some temperament swims. */
export interface SwimStyle {
  /** Cruising speed range for each leg, art px/s. */
  speedMin: number;
  speedMax: number;
  /** Idle time at each target, seconds. */
  pauseMin: number;
  pauseMax: number;
  /** How far the next target may be, as a share of its region's width and height. */
  reach: number;
}

const CALM: SwimStyle = { speedMin: 3, speedMax: 7, pauseMin: 1.5, pauseMax: 5, reach: 1 };
const JITTERY: SwimStyle = { speedMin: 12, speedMax: 24, pauseMin: 0.1, pauseMax: 0.9, reach: 0.3 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The swimming style for a temperament: a blend from calm (0) to jittery (1). */
export function swimStyle(temper: number = DEFAULT_TEMPER): SwimStyle {
  const t = Math.min(1, Math.max(0, temper));
  return {
    speedMin: lerp(CALM.speedMin, JITTERY.speedMin, t),
    speedMax: lerp(CALM.speedMax, JITTERY.speedMax, t),
    pauseMin: lerp(CALM.pauseMin, JITTERY.pauseMin, t),
    pauseMax: lerp(CALM.pauseMax, JITTERY.pauseMax, t),
    reach: lerp(CALM.reach, JITTERY.reach, t),
  };
}

/** Fish swim mostly sideways: vertical speed is scaled by this. */
export const VERTICAL_FACTOR = 0.4;
/** A hurrying fish rests at most this long when it arrives, seconds. */
const HURRY_PAUSE = 0.5;
/** Only turn round for targets at least this far sideways, to avoid flicker. */
const TURN_THRESHOLD = 2;
/** A leaving fish speeds up by this much. */
const LEAVE_SPEEDUP = 2.5;
/** A fish swimming into a new formation speeds up by this much. */
export const HURRY_SPEEDUP = 4;

const between = (rand: Rand, a: number, b: number) => a + (b - a) * rand();

/**
 * A random target in the bounds. With a `from` point and a reach below 1, the
 * target is within that share of the bounds' size from it (a short dart).
 */
function pickTarget(
  rand: Rand,
  b: Bounds,
  from?: { x: number; y: number },
  reach = 1,
): { targetX: number; targetY: number } {
  if (!from || reach >= 1) {
    return { targetX: between(rand, b.minX, b.maxX), targetY: between(rand, b.minY, b.maxY) };
  }
  const rx = (b.maxX - b.minX) * reach;
  const ry = (b.maxY - b.minY) * reach;
  const x = Math.min(b.maxX, Math.max(b.minX, from.x));
  const y = Math.min(b.maxY, Math.max(b.minY, from.y));
  return {
    targetX: between(rand, Math.max(b.minX, x - rx), Math.min(b.maxX, x + rx)),
    targetY: between(rand, Math.max(b.minY, y - ry), Math.min(b.maxY, y + ry)),
  };
}

export function spawn(rand: Rand, bounds: Bounds, temper: number = DEFAULT_TEMPER): SwimState {
  const style = swimStyle(temper);
  const x = between(rand, bounds.minX, bounds.maxX);
  const y = between(rand, bounds.minY, bounds.maxY);
  return {
    x,
    y,
    ...pickTarget(rand, bounds, { x, y }, style.reach),
    speed: between(rand, style.speedMin, style.speedMax),
    facing: rand() < 0.5 ? 1 : -1,
    pause: between(rand, 0, style.pauseMax),
    leaving: false,
    temper,
  };
}

/** Send a fish out of the nearest side of the tank. `width` is the sprite width. */
export function leave(state: SwimState, bounds: Bounds, width: number): SwimState {
  const goRight = state.x - bounds.minX > bounds.maxX - state.x;
  return {
    ...state,
    targetX: goRight ? bounds.maxX + width * 2 : bounds.minX - width * 2,
    targetY: state.y,
    pause: 0,
    leaving: true,
  };
}

/** Has a leaving fish fully left the tank? */
export function hasLeft(state: SwimState, bounds: Bounds, width: number): boolean {
  return state.leaving && (state.x > bounds.maxX + width || state.x < bounds.minX - width);
}

/**
 * Advance one fish by `dt` seconds. A hurrying fish (heading to a new region)
 * swims `hurrySpeedup` times its cruising speed.
 */
export function step(
  state: SwimState,
  dt: number,
  rand: Rand,
  bounds: Bounds,
  hurrySpeedup = HURRY_SPEEDUP,
): SwimState {
  if (state.pause > 0) return { ...state, pause: Math.max(0, state.pause - dt) };

  const dx = state.targetX - state.x;
  const dy = (state.targetY - state.y) / VERTICAL_FACTOR;
  const distance = Math.hypot(dx, dy);
  const speed = state.speed * (state.leaving ? LEAVE_SPEEDUP : state.hurry ? hurrySpeedup : 1);
  const facing: 1 | -1 = Math.abs(dx) >= TURN_THRESHOLD ? (dx > 0 ? 1 : -1) : state.facing;

  if (distance <= speed * dt) {
    if (state.leaving) {
      return { ...state, x: state.targetX, y: state.targetY, facing };
    }
    // Arrived: rest, then set off on a new leg at a new speed.
    const style = swimStyle(state.temper);
    const at = { x: state.targetX, y: state.targetY };
    return {
      ...state,
      ...at,
      facing,
      ...pickTarget(rand, bounds, at, style.reach),
      speed: between(rand, style.speedMin, style.speedMax),
      pause: state.hurry
        ? between(rand, 0, Math.min(HURRY_PAUSE, style.pauseMin))
        : between(rand, style.pauseMin, style.pauseMax),
      hurry: false,
    };
  }

  const travel = (speed * dt) / distance;
  return {
    ...state,
    x: state.x + dx * travel,
    y: state.y + dy * VERTICAL_FACTOR * travel,
    facing,
  };
}

/** Keep fish inside the bounds when the tank (or its territory) shrinks. */
export function clampTo(state: SwimState, bounds: Bounds): SwimState {
  if (state.leaving) return state;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    ...state,
    x: clamp(state.x, bounds.minX, bounds.maxX),
    y: clamp(state.y, bounds.minY, bounds.maxY),
    targetX: clamp(state.targetX, bounds.minX, bounds.maxX),
    targetY: clamp(state.targetY, bounds.minY, bounds.maxY),
  };
}

const inside = (x: number, y: number, b: Bounds) =>
  x >= b.minX - 0.5 && x <= b.maxX + 0.5 && y >= b.minY - 0.5 && y <= b.maxY + 0.5;

/**
 * A fish coming back into view (its pen shown again) at the spot it was
 * hidden. If its region moved meanwhile, it swims over like any regroup.
 */
export function resume(state: SwimState, bounds: Bounds, rand: Rand): SwimState {
  return regroup({ ...state, leaving: false, hurry: false }, bounds, rand);
}

/**
 * The fish's region changed (new territory, another arrangement). A fish
 * already inside just keeps its target in bounds; one outside hurries to a
 * random spot in the new region, swimming there rather than jumping.
 */
/** A hurrying fish appears at its target at once (rearranging set to instant). */
export function arrive(state: SwimState): SwimState {
  if (!state.hurry) return state;
  return { ...state, x: state.targetX, y: state.targetY, hurry: false };
}

export function regroup(state: SwimState, bounds: Bounds, rand: Rand): SwimState {
  if (state.leaving) return state;
  if (inside(state.x, state.y, bounds)) {
    if (inside(state.targetX, state.targetY, bounds)) return state;
    return { ...state, ...pickTarget(rand, bounds) };
  }
  return { ...state, ...pickTarget(rand, bounds), pause: 0, hurry: true };
}
