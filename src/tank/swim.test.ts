import { describe, expect, it } from 'vitest';
import {
  type Bounds,
  type SwimState,
  arrive,
  clampTo,
  hasLeft,
  leave,
  regroup,
  resume,
  spawn,
  step,
  swimStyle,
} from './swim';

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

describe('regroup', () => {
  const LEFT: Bounds = { minX: 0, minY: 6, maxX: 100, maxY: 150 };
  const RIGHT: Bounds = { minX: 200, minY: 6, maxX: 288, maxY: 150 };

  it('a fish outside its new region hurries there, then calms down', () => {
    const rand = seeded(7);
    let s = regroup({ ...spawn(rand, LEFT), x: 50, y: 50 }, RIGHT, rand);
    expect(s.hurry).toBe(true);
    expect(s.pause).toBe(0);
    expect(s.targetX).toBeGreaterThanOrEqual(200);
    let t = 0;
    while (s.hurry && t < 30) {
      s = step(s, 0.1, rand, RIGHT);
      t += 0.1;
    }
    expect(s.hurry).toBe(false);
    expect(s.x).toBeGreaterThanOrEqual(200);
    // Well under the ~15 s a cruising fish would take.
    expect(t).toBeLessThan(8);
  });

  it('a fish already inside stays calm', () => {
    const rand = seeded(3);
    const s = { ...spawn(rand, LEFT), x: 50, y: 50, targetX: 60, targetY: 60 };
    expect(regroup(s, LEFT, rand)).toBe(s);
  });
});

describe('resume', () => {
  const B: Bounds = { minX: 0, minY: 6, maxX: 288, maxY: 150 };

  it('a fish shown again picks up exactly where it was', () => {
    const rand = seeded(11);
    const parked = {
      ...spawn(rand, B),
      x: 123,
      y: 45,
      targetX: 130,
      targetY: 50,
      facing: -1 as const,
    };
    expect(resume(parked, B, rand)).toEqual({ ...parked, hurry: false });
  });

  it('if its patch moved while hidden, it swims to the new one', () => {
    const rand = seeded(12);
    const parked = { ...spawn(rand, B), x: 10, y: 45 };
    const s = resume(parked, { minX: 200, minY: 6, maxX: 288, maxY: 150 }, rand);
    expect(s).toMatchObject({ x: 10, y: 45, hurry: true });
  });
});

describe('temperament', () => {
  /** Swim for a while; report average leg length, speed and rest per leg. */
  function legs(temper: number) {
    const rand = seeded(7);
    let s = spawn(rand, BOUNDS, temper);
    let legs = 0;
    let distance = 0;
    let rest = 0;
    let speed = 0;
    for (let i = 0; i < 60 * 600; i++) {
      const before = s;
      s = step(s, 1 / 60, rand, BOUNDS);
      if (before.pause > 0) rest += 1 / 60;
      else if (s.pause > 0) {
        legs++;
        speed += before.speed;
      }
      distance += Math.hypot(s.x - before.x, s.y - before.y);
    }
    return { length: distance / legs, speed: speed / legs, rest: rest / legs };
  }

  it('makes calm fish glide far and slowly, with long rests', () => {
    const calm = legs(0);
    const jittery = legs(1);
    expect(calm.length).toBeGreaterThan(jittery.length * 2);
    expect(jittery.speed).toBeGreaterThan(calm.speed * 2);
    expect(calm.rest).toBeGreaterThan(jittery.rest * 3);
  });

  it('keeps jittery darts inside the bounds', () => {
    const rand = seeded(8);
    let s = spawn(rand, BOUNDS, 1);
    for (let i = 0; i < 20_000; i++) {
      s = step(s, 1 / 60, rand, BOUNDS);
      expect(s.x).toBeGreaterThanOrEqual(BOUNDS.minX);
      expect(s.x).toBeLessThanOrEqual(BOUNDS.maxX);
      expect(s.y).toBeGreaterThanOrEqual(BOUNDS.minY);
      expect(s.y).toBeLessThanOrEqual(BOUNDS.maxY);
    }
  });

  it('swims the middle way without a temperament', () => {
    expect(swimStyle(undefined)).toEqual(swimStyle(0.5));
    expect(swimStyle(-1)).toEqual(swimStyle(0));
    expect(swimStyle(2)).toEqual(swimStyle(1));
  });
});

describe('rearranging speed', () => {
  const hurrying: SwimState = {
    x: 0,
    y: 50,
    targetX: 200,
    targetY: 50,
    speed: 10,
    facing: 1,
    pause: 0,
    leaving: false,
    hurry: true,
  };

  it('swims a hurrying fish faster with a bigger speed-up', () => {
    const slow = step(hurrying, 1, seeded(4), BOUNDS, 2);
    const fast = step(hurrying, 1, seeded(4), BOUNDS, 10);
    expect(slow.x).toBeCloseTo(20, 9);
    expect(fast.x).toBeCloseTo(100, 9);
  });

  it('leaves everyday swimming at its own pace', () => {
    const idle = { ...hurrying, hurry: false };
    expect(step(idle, 1, seeded(4), BOUNDS, 10).x).toBeCloseTo(10, 9);
  });

  it('places a hurrying fish at its target at once when instant', () => {
    const there = arrive(hurrying);
    expect([there.x, there.y, there.hurry]).toEqual([200, 50, false]);
    const idle = { ...hurrying, hurry: false };
    expect(arrive(idle)).toBe(idle);
  });
});
