import { describe, expect, it } from 'vitest';
import {
  type Pellet,
  approach,
  foodFor,
  landed,
  mouthOf,
  nearest,
  sprinkle,
  stepPellets,
} from './food';

const water = { x: 10, y: 5, w: 100, h: 60 };
const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe('sprinkle', () => {
  it('drops pellets at the surface around the tap, inside the water', () => {
    const pellets = sprinkle(12, 3, water, seq([0, 0.5, 1]), ['a']);
    expect(pellets.every((p) => p.y === water.y + 1)).toBe(true);
    expect(pellets.every((p) => p.x >= water.x + 1 && p.x <= water.x + water.w - 2)).toBe(true);
  });
});

describe('stepPellets', () => {
  it('waits, sinks to the sand, rests there, then goes', () => {
    let p: Pellet[] = [{ x: 20, y: 6, delay: 0.5, rest: 0, for: ['a'] }];
    p = stepPellets(p, 0.4, 50);
    expect(landed(p)).toHaveLength(0);
    p = stepPellets(p, 0.2, 50);
    expect(p[0]).toMatchObject({ delay: 0, y: 6 });
    p = stepPellets(p, 100, 50);
    expect(p[0]?.y).toBe(50);
    p = stepPellets(p, 7, 50);
    expect(p).toHaveLength(1);
    p = stepPellets(p, 2, 50);
    expect(p).toHaveLength(0);
  });
});

describe('chasing food', () => {
  it('finds the nearest pellet to a mouth, and swims so the mouth meets it', () => {
    const shark = { x: 40, y: 20, facing: 1 as const };
    expect(mouthOf(shark)).toEqual({ x: 68, y: 33 });
    const a = { x: 90, y: 30, delay: 0, rest: 0, for: [] };
    const b = { x: 20, y: 30, delay: 0, rest: 0, for: [] };
    expect(nearest([a, b], mouthOf(shark))).toBe(a);
    // Ahead of it: mouth (the front) to the pellet. Behind it: turns, the mouth on the other side.
    expect(approach(shark, a, 32)).toEqual({ targetX: 62, targetY: 17, facing: 1 });
    expect(approach(shark, b, 32)).toEqual({ targetX: 17, targetY: 17, facing: -1 });
  });
});

describe('who eats', () => {
  it('only the sharks the food is for: those not yet fed today', () => {
    const one = sprinkle(50, 2, water, seq([0.5]), ['a']);
    const hungry = sprinkle(50, 1, water, seq([0.5]), ['a', 'b']);
    const all = [...one, ...hungry];
    expect(foodFor(all, 'a')).toHaveLength(3);
    expect(foodFor(all, 'b')).toEqual(hungry);
    expect(foodFor(all, 'c')).toEqual([]);
  });
});
