import { describe, expect, it } from 'vitest';
import { type Bounds, type SwimState, clampTo, hasLeft, leave, spawn, step } from './swim';

/** Deterministic PRNG (mulberry32) so runs are repeatable. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BOUNDS: Bounds = { minX: 0, minY: 10, maxX: 288, maxY: 145 };

describe('swim', () => {
  it('stays inside the bounds for a long time', () => {
    const rand = seeded(1);
    let s = spawn(rand, BOUNDS);
    for (let i = 0; i < 20_000; i++) {
      s = step(s, 1 / 60, rand, BOUNDS);
      expect(s.x).toBeGreaterThanOrEqual(BOUNDS.minX);
      expect(s.x).toBeLessThanOrEqual(BOUNDS.maxX);
      expect(s.y).toBeGreaterThanOrEqual(BOUNDS.minY);
      expect(s.y).toBeLessThanOrEqual(BOUNDS.maxY);
    }
  });

  it('faces the way it swims', () => {
    const base: SwimState = {
      x: 100,
      y: 50,
      targetX: 200,
      targetY: 50,
      speed: 10,
      facing: -1,
      pause: 0,
      leaving: false,
    };
    expect(step(base, 0.1, seeded(2), BOUNDS).facing).toBe(1);
    expect(step({ ...base, targetX: 0 }, 0.1, seeded(2), BOUNDS).facing).toBe(-1);
    // A target straight above doesn't make it turn.
    expect(step({ ...base, targetX: 101 }, 0.1, seeded(2), BOUNDS).facing).toBe(-1);
  });

  it('moves at its speed, slower vertically, and pauses on arrival', () => {
    const s: SwimState = {
      x: 0,
      y: 50,
      targetX: 100,
      targetY: 50,
      speed: 10,
      facing: 1,
      pause: 0,
      leaving: false,
    };
    expect(step(s, 1, seeded(3), BOUNDS).x).toBeCloseTo(10, 9);
    const up = step({ ...s, targetX: 0, targetY: 0 }, 1, seeded(3), BOUNDS);
    expect(50 - up.y).toBeCloseTo(4, 9); // 10 px/s × 0.4
    const arrived = step({ ...s, targetX: 5 }, 1, seeded(3), BOUNDS);
    expect(arrived.x).toBe(5);
    expect(arrived.pause).toBeGreaterThan(0);
    expect(step(arrived, 0.1, seeded(3), BOUNDS).x).toBe(5); // still pausing
  });

  it('a leaving fish swims out and is reported gone', () => {
    const rand = seeded(4);
    let s = leave({ ...spawn(rand, BOUNDS), x: 250 }, BOUNDS, 32);
    expect(s.leaving).toBe(true);
    let frames = 0;
    while (!hasLeft(s, BOUNDS, 32) && frames < 10_000) {
      s = step(s, 1 / 60, rand, BOUNDS);
      frames++;
    }
    expect(hasLeft(s, BOUNDS, 32)).toBe(true);
    expect(s.x).toBeGreaterThan(BOUNDS.maxX);
  });

  it('clampTo pulls a fish and its target into smaller bounds', () => {
    const s = clampTo(
      { ...spawn(seeded(5), BOUNDS), x: 280, targetX: 280, y: 140 },
      { minX: 0, minY: 10, maxX: 100, maxY: 60 },
    );
    expect(s).toMatchObject({ x: 100, targetX: 100, y: 60 });
  });
});
