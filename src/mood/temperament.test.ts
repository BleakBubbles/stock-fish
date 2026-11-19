import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPER, SIGMA_CALM, SIGMA_JITTERY, temperFor } from './temperament';

describe('temperFor', () => {
  it('is calm at low volatility and jittery at high', () => {
    expect(temperFor(SIGMA_CALM)).toBe(0);
    expect(temperFor(0.001)).toBe(0);
    expect(temperFor(SIGMA_JITTERY)).toBeCloseTo(1, 12);
    expect(temperFor(0.2)).toBe(1);
  });

  it('rises with volatility on a log scale', () => {
    expect(temperFor(0.01)).toBeCloseTo(1 / 3, 6); // σ doubled once of three doublings
    expect(temperFor(0.02)).toBeCloseTo(2 / 3, 6);
    expect(temperFor(0.012)).toBeGreaterThan(temperFor(0.011));
  });

  it('swims the middle way when σ is unknown or unusable', () => {
    for (const sigma of [undefined, Number.NaN, 0, -0.01, Number.POSITIVE_INFINITY]) {
      expect(temperFor(sigma), String(sigma)).toBe(DEFAULT_TEMPER);
    }
  });
});
