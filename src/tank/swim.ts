/**
 * Fish movement in art pixels. Pure: positions are floats here and get
 * rounded to whole art pixels only when drawn (CLAUDE.md, firm rule 4).
 * Fish wander between random targets, pause, and face where they're going.
 */

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
}

export type Rand = () => number;

/** Cruising speed range, art px/s. */
export const SPEED_MIN = 6;
export const SPEED_MAX = 14;
/** Fish swim mostly sideways: vertical speed is scaled by this. */
export const VERTICAL_FACTOR = 0.4;
/** Idle time at each target, seconds. */
export const PAUSE_MIN = 0.5;
export const PAUSE_MAX = 3;
/** Only turn round for targets at least this far sideways, to avoid flicker. */
const TURN_THRESHOLD = 2;
/** A leaving fish speeds up by this much. */
const LEAVE_SPEEDUP = 2.5;
/** A fish swimming into a new formation speeds up by this much. */
export const HURRY_SPEEDUP = 4;

const between = (rand: Rand, a: number, b: number) => a + (b - a) * rand();

function pickTarget(rand: Rand, b: Bounds): { targetX: number; targetY: number } {
  return { targetX: between(rand, b.minX, b.maxX), targetY: between(rand, b.minY, b.maxY) };
}

export function spawn(rand: Rand, bounds: Bounds): SwimState {
  const x = between(rand, bounds.minX, bounds.maxX);
  const y = between(rand, bounds.minY, bounds.maxY);
  return {
    x,
    y,
    ...pickTarget(rand, bounds),
    speed: between(rand, SPEED_MIN, SPEED_MAX),
    facing: rand() < 0.5 ? 1 : -1,
    pause: between(rand, 0, PAUSE_MAX),
    leaving: false,
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

/** Advance one fish by `dt` seconds. */
export function step(state: SwimState, dt: number, rand: Rand, bounds: Bounds): SwimState {
  if (state.pause > 0) return { ...state, pause: Math.max(0, state.pause - dt) };

  const dx = state.targetX - state.x;
  const dy = (state.targetY - state.y) / VERTICAL_FACTOR;
  const distance = Math.hypot(dx, dy);
  const speed = state.speed * (state.leaving ? LEAVE_SPEEDUP : state.hurry ? HURRY_SPEEDUP : 1);
  const facing: 1 | -1 = Math.abs(dx) >= TURN_THRESHOLD ? (dx > 0 ? 1 : -1) : state.facing;

  if (distance <= speed * dt) {
    if (state.leaving) {
      return { ...state, x: state.targetX, y: state.targetY, facing };
    }
    return {
      ...state,
      x: state.targetX,
      y: state.targetY,
      facing,
      ...pickTarget(rand, bounds),
      pause: state.hurry ? between(rand, 0, PAUSE_MIN) : between(rand, PAUSE_MIN, PAUSE_MAX),
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
export function regroup(state: SwimState, bounds: Bounds, rand: Rand): SwimState {
  if (state.leaving) return state;
  if (inside(state.x, state.y, bounds)) {
    if (inside(state.targetX, state.targetY, bounds)) return state;
    return { ...state, ...pickTarget(rand, bounds) };
  }
  return { ...state, ...pickTarget(rand, bounds), pause: 0, hurry: true };
}
