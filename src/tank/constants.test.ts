import { describe, expect, it } from 'vitest';
import { MAX_TALL, MAX_WIDE, MIN_TANK, tankSize } from './constants';

describe('tankSize', () => {
  it('fills the box at the preferred scale, in whole art pixels', () => {
    expect(tankSize(1400, 600, 4)).toEqual({ scale: 4, width: 350, height: 150 });
    expect(tankSize(1281, 719, 4)).toEqual({ scale: 4, width: 320, height: 179 });
  });

  it('keeps a tall box from making a tall tank', () => {
    const t = tankSize(750, 1400, 2);
    expect(t.width).toBe(375);
    expect(t.height).toBe(Math.floor(375 * MAX_TALL));
  });

  it('keeps an ultra-wide box from making a sliver', () => {
    const t = tankSize(3000, 400, 2);
    expect(t.height).toBe(200);
    expect(t.width).toBe(Math.floor(200 * MAX_WIDE));
  });

  it('steps the scale down before going below the smallest tank', () => {
    expect(tankSize(700, 400, 3)).toMatchObject({ scale: 2 });
    const tiny = tankSize(100, 100, 3);
    expect(tiny).toEqual({ scale: 1, width: MIN_TANK.w, height: MIN_TANK.h });
  });
});
