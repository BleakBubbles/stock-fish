import { describe, expect, it } from 'vitest';
import type { Bar } from './volatility';
import { type Position, portfolioWeather } from './weather';

const DAY = 86_400_000;
const START = Date.UTC(2026, 0, 1);
const iso = (i: number) => new Date(START + i * DAY).toISOString().slice(0, 10);

/** `count` closes whose returns alternate ±r, starting at 100, from day `offset`. */
function zigzag(count: number, r: number, offset = 0): Bar[] {
  const out: Bar[] = [];
  let close = 100;
  for (let i = 0; i < count; i++) {
    if (i > 0) close *= (i + offset) % 2 ? 1 + r : 1 - r;
    out.push({ date: iso(i + offset), close });
  }
  return out;
}

function position(history: Bar[], move: number, quantity = 1): Position {
  const previousClose = history.at(-1)!.close;
  return { quantity, previousClose, price: previousClose * (1 + move), history };
}

describe('portfolioWeather', () => {
  it('is calm and empty with no usable positions', () => {
    expect(portfolioWeather([])).toMatchObject({ weather: 'calm', reason: 'empty', change: 0 });
    const bad = { quantity: 1, price: 10, previousClose: 0, history: [] };
    expect(portfolioWeather([bad]).reason).toBe('empty');
  });

  it('matches the single holding mood for a one-fish tank', () => {
    const h = zigzag(61, 0.01);
    expect(portfolioWeather([position(h, 0.03)]).weather).toBe('sunny');
    expect(portfolioWeather([position(h, 0.01)]).weather).toBe('fair');
    expect(portfolioWeather([position(h, 0)]).weather).toBe('calm');
    expect(portfolioWeather([position(h, -0.01)]).weather).toBe('rainy');
    expect(portfolioWeather([position(h, -0.03)]).weather).toBe('stormy');
  });

  it('sums value change and weights the return by value', () => {
    const h = zigzag(61, 0.01);
    const a = position(h, 0.02, 3); // 3 shares
    const b = position(h, -0.01, 1);
    const result = portfolioWeather([a, b]);
    const prev = h.at(-1)!.close;
    expect(result.change).toBeCloseTo(3 * prev * 0.02 - prev * 0.01, 9);
    expect(result.changeRatio).toBeCloseTo((3 * 0.02 - 0.01) / 4, 12);
  });

  it('offsetting holdings cancel out in σ', () => {
    // Two equal holdings that always move opposite: the portfolio's history is flat,
    // so the weather stays calm instead of dividing by almost nothing.
    const up = zigzag(61, 0.02, 0);
    const down = zigzag(61, 0.02, 1).map((b, i) => ({ ...b, date: iso(i) }));
    const today = portfolioWeather([position(up, 0.01), position(down, 0.01)]);
    expect(today.sigma).toBeLessThan(0.001);
    expect(today).toMatchObject({ weather: 'calm', reason: 'flat-history' });
  });

  it('is calm with too little combined history', () => {
    const result = portfolioWeather([position(zigzag(10, 0.01), 0.05)]);
    expect(result).toMatchObject({ weather: 'calm', reason: 'short-history' });
    expect(result.changeRatio).toBeCloseTo(0.05, 12);
  });

  it('skips days when most of the value has no data (a big new listing)', () => {
    const old = zigzag(61, 0.01); // small, long history
    const fresh = zigzag(5, 0.2, 56); // huge, 5 days old, wild
    const result = portfolioWeather([position(old, 0, 1), position(fresh, 0, 100)]);
    // Only the 4 days the big holding covers pass the coverage rule: not enough.
    expect(result.reason).toBe('short-history');
  });
});
