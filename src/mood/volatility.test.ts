import { describe, expect, it } from 'vitest';
import { sampleStdDev } from './stats';
import { type Bar, MIN_RETURNS, completedBars, typicalVolatility } from './volatility';

/** Weekday-ish dates are irrelevant here; consecutive ISO dates keep order obvious. */
function bars(closes: number[], start = Date.UTC(2026, 0, 1)): Bar[] {
  return closes.map((close, i) => ({
    date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
    close,
  }));
}

/** Closes alternating ±r around 100, so every return has the same size. */
function zigzag(count: number, r: number): number[] {
  const closes = [100];
  for (let i = 1; i < count; i++) closes.push(closes[i - 1]! * (1 + (i % 2 ? r : -r)));
  return closes;
}

describe('completedBars', () => {
  it('drops bars on or after asOf, bad closes and duplicate dates, and sorts', () => {
    const input: Bar[] = [
      { date: '2026-01-03', close: 12 },
      { date: '2026-01-01', close: 10 },
      { date: '2026-01-02', close: 0 },
      { date: '2026-01-01', close: 11 },
      { date: '2026-01-04', close: 13 },
    ];
    expect(completedBars(input, '2026-01-04')).toEqual([
      { date: '2026-01-01', close: 11 },
      { date: '2026-01-03', close: 12 },
    ]);
    expect(completedBars(input)).toHaveLength(3);
  });
});

describe('typicalVolatility', () => {
  it('is the sample σ of daily returns', () => {
    const closes = zigzag(61, 0.01);
    const sigma = typicalVolatility(bars(closes));
    const returns = closes.slice(1).map((c, i) => c / closes[i]! - 1);
    expect(sigma).toBeCloseTo(sampleStdDev(returns), 12);
    expect(sigma).toBeCloseTo(0.01, 3);
  });

  it('uses only the last 60 returns', () => {
    // 100 calm returns, then 60 wild ones: σ should reflect only the wild ones.
    const calm = zigzag(101, 0.001);
    const wild = zigzag(61, 0.05).map((c) => (c / 100) * calm.at(-1)!);
    const series = [...calm, ...wild.slice(1)];
    expect(typicalVolatility(bars(series))).toBeCloseTo(0.05, 2);
  });

  it("ignores today's unfinished bar", () => {
    const closes = [...zigzag(61, 0.01), 200]; // last bar: a huge move "today"
    const b = bars(closes);
    const today = b.at(-1)!.date;
    expect(typicalVolatility(b, today)).toBeCloseTo(0.01, 3);
    expect(typicalVolatility(b)!).toBeGreaterThan(0.05);
  });

  it(`needs at least ${MIN_RETURNS} returns`, () => {
    expect(typicalVolatility(bars(zigzag(MIN_RETURNS, 0.01)))).toBeUndefined();
    expect(typicalVolatility(bars(zigzag(MIN_RETURNS + 1, 0.01)))).toBeDefined();
    expect(typicalVolatility([])).toBeUndefined();
  });

  it('is 0 for a flat series', () => {
    expect(typicalVolatility(bars(Array(30).fill(10)))).toBe(0);
  });
});
