/**
 * Tail wag: which tail pose a fish shows, from how it's moving. Pure.
 *
 * One wag is four steps (mid, up, mid, down). Swimming fish wag faster the
 * faster they go; a fish at rest holds its tail still with an occasional
 * single flick; a sleeping fish's tail doesn't move.
 */
import type { TailPose } from '../theme/grid';
import type { Rand } from './swim';

const CYCLE: readonly TailPose[] = ['mid', 'up', 'mid', 'down'];

/** Wags per second while cruising: a base plus a little per art pixel/second of speed. */
export const WAG_BASE = 1.2;
export const WAG_PER_SPEED = 0.12;
/** Faster when hurrying into formation; fastest when picked up. */
export const HURRY_WAG = 2;
export const HELD_WAGS = 4;
/** A resting fish flicks its tail once every few seconds. */
export const FLICK_RATE = 3;
export const FLICK_GAP_MIN = 2;
export const FLICK_GAP_MAX = 6;

export type TailMotion = 'swim' | 'hurry' | 'rest' | 'asleep' | 'held';

export interface TailState {
  /** Position in the wag cycle, in steps (0–4). */
  phase: number;
  /** Steps left of a resting flick (0 when not flicking). */
  flick: number;
  /** Seconds until a resting fish's next flick. */
  wait: number;
}

export const STILL_TAIL: TailState = { phase: 0, flick: 0, wait: FLICK_GAP_MIN };

const between = (rand: Rand, a: number, b: number) => a + (b - a) * rand();

/** Advance the tail by `dt` seconds. `speed` is the fish's art pixels per second. */
export function stepTail(
  t: TailState,
  dt: number,
  motion: TailMotion,
  speed: number,
  rand: Rand,
): TailState {
  if (motion === 'asleep') return { ...STILL_TAIL, wait: t.wait };
  if (motion === 'rest') {
    if (t.flick > 0) {
      const steps = Math.min(t.flick, dt * FLICK_RATE * CYCLE.length);
      const flick = t.flick - steps;
      // A flick ends back at mid.
      return flick > 0
        ? { ...t, phase: (t.phase + steps) % CYCLE.length, flick }
        : { phase: 0, flick: 0, wait: between(rand, FLICK_GAP_MIN, FLICK_GAP_MAX) };
    }
    const wait = t.wait - dt;
    return wait > 0 ? { ...t, phase: 0, wait } : { phase: 0, flick: CYCLE.length, wait: 0 };
  }
  const wags =
    motion === 'held'
      ? HELD_WAGS
      : (WAG_BASE + speed * WAG_PER_SPEED) * (motion === 'hurry' ? HURRY_WAG : 1);
  return { ...t, phase: (t.phase + dt * wags * CYCLE.length) % CYCLE.length, flick: 0 };
}

export function tailPose(t: TailState): TailPose {
  return CYCLE[Math.floor(t.phase) % CYCLE.length] ?? 'mid';
}
