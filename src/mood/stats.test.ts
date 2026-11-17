import { describe, expect, it } from 'vitest';
import { dailyReturns, mean, sampleStdDev, simpleReturn } from './stats';

describe('stats', () => {
  it('mean', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(mean([])).toBeNaN();
  });

  it('sample standard deviation uses n − 1', () => {
    // Classic example: population σ is 2, sample σ is sqrt(32/7).
    expect(sampleStdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(Math.sqrt(32 / 7), 12);
    expect(sampleStdDev([3, 3, 3])).toBe(0);
    expect(sampleStdDev([1])).toBeNaN();
  });

  it('simple returns', () => {
    expect(simpleReturn(100, 102)).toBeCloseTo(0.02, 12);
    expect(simpleReturn(100, 0)).toBe(-1);
    expect(simpleReturn(0, 5)).toBeNaN();
    expect(simpleReturn(-1, 5)).toBeNaN();
    expect(simpleReturn(100, NaN)).toBeNaN();
  });

  it('daily returns of a series', () => {
    const r = dailyReturns([100, 110, 99]);
    expect(r).toHaveLength(2);
    expect(r[0]).toBeCloseTo(0.1, 12);
    expect(r[1]).toBeCloseTo(-0.1, 12);
    expect(dailyReturns([100])).toEqual([]);
  });
});
