import { describe, expect, it } from 'vitest';
import { Z_SPAN, rangeBarLayout } from './rangeBarLayout';

describe('rangeBarLayout', () => {
  it('is odd-width and symmetric about zero, in whole pixels', () => {
    const l = rangeBarLayout(0, 100);
    expect(l.width).toBe(99);
    const mid = (l.width - 1) / 2;
    expect(l.marker).toBe(mid);
    expect(l.band.x + l.band.w - 1 - mid).toBe(mid - l.band.x);
    expect(l.ticks[1] - mid).toBe(mid - l.ticks[0]);
    for (const v of [l.band.x, l.band.w, ...l.ticks, l.marker]) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('puts calm days inside the band and strong days past the ticks', () => {
    const calm = rangeBarLayout(0.3, 99);
    expect(calm.marker).toBeGreaterThanOrEqual(calm.band.x);
    expect(calm.marker).toBeLessThan(calm.band.x + calm.band.w);
    const happy = rangeBarLayout(1, 99);
    expect(happy.marker).toBeGreaterThanOrEqual(happy.band.x + happy.band.w);
    expect(happy.marker).toBeLessThan(happy.ticks[1]);
    const sad = rangeBarLayout(-2.5, 99);
    expect(sad.marker).toBeLessThan(sad.ticks[0]);
  });

  it('stops the marker at the edge on huge days, and says so', () => {
    const up = rangeBarLayout(Z_SPAN * 4, 99);
    expect(up.beyond).toBe(1);
    expect(up.marker).toBe(up.width - 2);
    const down = rangeBarLayout(-Z_SPAN * 4, 99);
    expect(down.beyond).toBe(-1);
    expect(down.marker).toBe(1);
    expect(rangeBarLayout(Z_SPAN, 99).beyond).toBe(0);
  });

  it('treats an unusable z as zero', () => {
    const l = rangeBarLayout(Number.NaN, 99);
    expect(l.marker).toBe(49);
    expect(l.beyond).toBe(0);
  });
});
