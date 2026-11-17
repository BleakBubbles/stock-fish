import { describe, expect, it } from 'vitest';
import type { Holding, MarketEntry, SymbolProfile } from '../data/model';
import type { DailyBar } from '../data/providers/types';
import { defaultColours } from '../theme';
import { buildFish, weatherFor } from './model';

const holding = (symbol: string, quantity = 10, extra: Partial<Holding> = {}): Holding => ({
  id: `h-${symbol}`,
  symbol,
  quantity,
  penId: 'p',
  createdAt: 0,
  ...extra,
});

/** 61 closes alternating ±1 %, then today's bar. */
function bars(): DailyBar[] {
  const out: DailyBar[] = [];
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

function entry(symbol: string, move: number): MarketEntry {
  const b = bars();
  const prev = b.at(-1)!.close;
  return {
    symbol,
    provider: 'mock',
    bars: b,
    barsAt: 1,
    quote: {
      symbol,
      price: prev * (1 + move),
      previousClose: prev,
      timestamp: 1,
      tradingDay: '2026-03-03',
    },
    quoteAt: 1,
  };
}

describe('buildFish', () => {
  const profiles = new Map<string, SymbolProfile>([
    ['ZZZ', { symbol: 'ZZZ', userSector: 'Energy' }],
  ]);

  it('derives body, colours, mood and change per holding', () => {
    const market = new Map([['INTC', entry('INTC', 0.03)]]);
    const [fish] = buildFish([holding('INTC', 4)], profiles, market);
    expect(fish).toMatchObject({
      id: 'h-INTC',
      body: 1, // built-in table: Information Technology
      mood: 'ecstatic',
      state: 'ok',
      ...defaultColours('INTC'),
    });
    expect(fish!.change).toBeCloseTo(4 * market.get('INTC')!.quote!.previousClose * 0.03, 9);
  });

  it("uses the user's family and colours", () => {
    const [fish] = buildFish([holding('ZZZ', 1, { primary: '262b44' })], profiles, new Map());
    expect(fish).toMatchObject({ body: 4, primary: '262b44', mood: 'neutral', state: 'loading' });
  });

  it('marks fish whose fetch failed', () => {
    const market = new Map<string, MarketEntry>([
      [
        'BAD',
        { symbol: 'BAD', provider: 'mock', error: { kind: 'not-found', message: 'nope', at: 1 } },
      ],
    ]);
    expect(buildFish([holding('BAD')], profiles, market)[0]).toMatchObject({
      state: 'error',
      error: 'nope',
      mood: 'neutral',
    });
  });
});

describe('weatherFor', () => {
  it('counts only fish with quotes', () => {
    const market = new Map([['A', entry('A', -0.03)]]);
    const fish = buildFish([holding('A'), holding('B')], new Map(), market);
    expect(weatherFor(fish, market).weather).toBe('stormy');
    expect(weatherFor([], market).reason).toBe('empty');
  });
});
