import { describe, expect, it } from 'vitest';
import {
  MIN_FOR_MARKET,
  averageLinkage,
  correlation,
  kinship,
  marketAdjusted,
  returnSeries,
  togetherWords,
} from './correlation';
import type { Bar } from './volatility';

/** Small seeded generator, so the made-up markets are the same every run. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32 - 0.5;
  };
}

const DAYS = 61;
const date = (i: number) =>
  new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);

/** Bars from daily returns, starting at 100. */
function bars(returns: number[]): Bar[] {
  let close = 100;
  return [{ date: date(0), close }].concat(
    returns.map((r, i) => {
      close *= 1 + r;
      return { date: date(i + 1), close };
    }),
  );
}

/**
 * A made-up portfolio: everything rides a strong market move; A, B, C also
 * share one sector's move, D and E another; F has only its own noise.
 */
function portfolio() {
  const rand = rng(7);
  const series = (n: number) => Array.from({ length: n }, () => rand() * 0.02);
  const market = series(DAYS - 1).map((x) => x * 2);
  const chips = series(DAYS - 1);
  const banks = series(DAYS - 1);
  const make = (sector: number[] | undefined) =>
    bars(market.map((m, i) => m + (sector?.[i] ?? 0) + rand() * 0.008));
  return new Map([
    ['A', { bars: make(chips) }],
    ['B', { bars: make(chips) }],
    ['C', { bars: make(chips) }],
    ['D', { bars: make(banks) }],
    ['E', { bars: make(banks) }],
    ['F', { bars: make(undefined) }],
  ]);
}

describe('returnSeries', () => {
  it('keys each completed day’s return by its date, last 60 only', () => {
    const s = returnSeries(bars([0.01, -0.02, 0.03]));
    expect([...s.keys()]).toEqual([date(1), date(2), date(3)]);
    expect(s.get(date(2))).toBeCloseTo(-0.02, 12);
    // Today's unfinished bar doesn't count.
    expect(returnSeries(bars([0.01, -0.02, 0.03]), date(3)).size).toBe(2);
    expect(returnSeries(bars(Array(80).fill(0.001))).size).toBe(60);
  });
});

describe('correlation', () => {
  const s = (values: number[]) => new Map(values.map((v, i) => [date(i), v]));

  it('is 1 for series moving alike, −1 for opposite, over shared days only', () => {
    const a = s([0.01, -0.02, 0.03, 0.0]);
    expect(correlation(a, s([0.02, -0.04, 0.06, 0.0]), 3)).toBeCloseTo(1, 12);
    expect(correlation(a, s([-0.01, 0.02, -0.03, 0.0]), 3)).toBeCloseTo(-1, 12);
    expect(correlation(a, new Map([[date(0), 0.01]]), 3)).toBeUndefined();
  });

  it('is unknown for a flat series', () => {
    expect(correlation(s([0.01, 0.02, 0.03]), s([0, 0, 0]), 3)).toBeUndefined();
  });
});

describe('averageLinkage', () => {
  const table: Record<string, number> = { 'a|b': 0.9, 'a|c': 0.6, 'b|c': 0.2, 'c|d': 0.7 };
  const corr = (x: string, y: string) => table[`${x}|${y}`] ?? table[`${y}|${x}`];

  it('merges the closest groups while their average is high enough', () => {
    // a+b first (0.9); then {a,b}–c averages 0.4, c–d is 0.7.
    expect(averageLinkage(['a', 'b', 'c', 'd'], corr, 0.5)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('does not chain through one in-between member', () => {
    // Single linkage would join a, b and c through a–c (0.6); average linkage doesn't.
    expect(averageLinkage(['a', 'b', 'c'], corr, 0.5)).toEqual([['a', 'b'], ['c']]);
  });
});

describe('kinship', () => {
  it('finds the sectors under the market move', () => {
    const k = kinship(portfolio());
    expect(k.groups.map((g) => g.symbols)).toEqual([
      ['A', 'B', 'C'],
      ['D', 'E'],
    ]);
    expect(k.alone).toEqual(['F']);
    expect(k.unknown).toEqual([]);
    expect(k.groups[0]!.tightness).toBeGreaterThan(0.5);
    expect(['B', 'C']).toContain(k.closest.get('A')?.symbol);
  });

  it('would lump everything together without taking the market out', () => {
    const raw = new Map([...portfolio()].map(([s, h]) => [s, returnSeries(h.bars)]));
    const plain = correlation(raw.get('A')!, raw.get('F')!)!;
    const adjusted = marketAdjusted(raw);
    expect(plain).toBeGreaterThan(0.5);
    expect(correlation(adjusted.get('A')!, adjusted.get('F')!)!).toBeLessThan(0.5);
  });

  it('compares plain returns with too few holdings to make a market', () => {
    const few = new Map([...portfolio()].slice(0, MIN_FOR_MARKET - 1));
    const raw = new Map([...few].map(([s, h]) => [s, returnSeries(h.bars)]));
    expect(marketAdjusted(raw)).toEqual(raw);
    // A, B, C and D all ride the market, so they read as one group.
    expect(kinship(few).groups.map((g) => g.symbols)).toEqual([['A', 'B', 'C', 'D']]);
  });

  it('sets aside symbols without enough history', () => {
    const p = portfolio();
    p.set('NEW', { bars: bars([0.01, 0.02]) });
    expect(kinship(p).unknown).toEqual(['NEW']);
  });
});

describe('togetherWords', () => {
  it('puts a correlation into words', () => {
    expect(togetherWords(0.85)).toBe('Very closely');
    expect(togetherWords(0.65)).toBe('Closely');
    expect(togetherWords(0.45)).toBe('Somewhat');
    expect(togetherWords(0.25)).toBe('Loosely');
    expect(togetherWords(0.05)).toBe('Hardly');
  });
});
