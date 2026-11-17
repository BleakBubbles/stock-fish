import { describe, expect, it } from 'vitest';
import { assessMood, tierFor } from './tiers';
import type { Bar } from './volatility';

describe('tierFor', () => {
  it.each([
    [3, 'ecstatic'],
    [2.0001, 'ecstatic'],
    [2, 'happy'],
    [0.5, 'happy'],
    [0.4999, 'neutral'],
    [0, 'neutral'],
    [-0.4999, 'neutral'],
    [-0.5, 'uneasy'],
    [-2, 'uneasy'],
    [-2.0001, 'sad'],
    [-10, 'sad'],
    [NaN, 'neutral'],
    [Infinity, 'neutral'],
  ] as const)('z = %d → %s', (z, mood) => {
    expect(tierFor(z)).toBe(mood);
  });

  it('accepts other thresholds', () => {
    expect(tierFor(1, { mild: 1, strong: 3 })).toBe('happy');
    expect(tierFor(0.9, { mild: 1, strong: 3 })).toBe('neutral');
  });
});

/** 61 closes whose daily returns alternate ±1 %, so σ ≈ 1 %. Last date: 2026-03-02. */
function onePercentHistory(): Bar[] {
  const out: Bar[] = [];
  let close = 100;
  for (let i = 0; i < 61; i++) {
    if (i > 0) close *= i % 2 ? 1.01 : 0.99;
    out.push({
      date: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10),
      close,
    });
  }
  return out;
}

describe('assessMood', () => {
  const history = onePercentHistory();
  const prev = history.at(-1)!.close;

  it.each([
    [0.03, 'ecstatic'],
    [0.01, 'happy'],
    [0.002, 'neutral'],
    [-0.01, 'uneasy'],
    [-0.03, 'sad'],
  ] as const)('a %d move with σ ≈ 1 %% is %s', (move, mood) => {
    const result = assessMood({ price: prev * (1 + move), previousClose: prev, history });
    expect(result.mood).toBe(mood);
    expect(result.reason).toBe('ok');
    expect(result.todayReturn).toBeCloseTo(move, 12);
    expect(result.sigma).toBeCloseTo(0.01, 3);
  });

  it('scales by the asset: −2 % is sad for a calm asset and calm for a wild one', () => {
    const calm = history.map((b, i) => ({ ...b, close: 100 * (1 + (i % 2 ? 0.002 : 0)) }));
    const wild = history.map((b, i) => ({ ...b, close: 100 * (1 + (i % 2 ? 0.08 : 0)) }));
    expect(assessMood({ price: 98, previousClose: 100, history: calm }).mood).toBe('sad');
    expect(assessMood({ price: 98, previousClose: 100, history: wild }).mood).toBe('neutral');
  });

  it("drops today's bar so the move doesn't dampen itself", () => {
    const today = { date: '2026-03-03', close: prev * 1.05 };
    const withToday = [...history, today];
    const input = { price: today.close, previousClose: prev, history: withToday };
    expect(assessMood({ ...input, asOf: today.date }).sigma).toBeCloseTo(0.01, 3);
    expect(assessMood({ ...input, asOf: today.date }).mood).toBe('ecstatic');
  });

  it('is neutral with fewer than 20 days of history', () => {
    const result = assessMood({ price: 200, previousClose: 100, history: history.slice(0, 15) });
    expect(result).toMatchObject({ mood: 'neutral', reason: 'short-history' });
    expect(result.todayReturn).toBeCloseTo(1, 12);
  });

  it('is neutral for flat history and for unusable quotes', () => {
    const flat = history.map((b) => ({ ...b, close: 50 }));
    expect(assessMood({ price: 51, previousClose: 50, history: flat })).toMatchObject({
      mood: 'neutral',
      reason: 'flat-history',
    });
    expect(assessMood({ price: 51, previousClose: 0, history })).toMatchObject({
      mood: 'neutral',
      reason: 'bad-quote',
    });
    expect(assessMood({ price: NaN, previousClose: 50, history }).reason).toBe('bad-quote');
  });
});
