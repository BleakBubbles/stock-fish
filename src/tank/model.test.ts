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

describe('day-old prices', () => {
  it("sleep calm, keep that day's move, and count as no move today", () => {
    const market = new Map([
      ['FUND', entry('FUND', -0.03)],
      ['A', entry('A', 0.01)],
    ]);
    const staleSince = (symbol: string) => (symbol === 'FUND' ? '2026-03-03' : undefined);
    const fish = buildFish(
      [holding('FUND'), holding('A')],
      new Map(),
      market,
      undefined,
      staleSince,
    );
    expect(fish[0]).toMatchObject({ stale: '2026-03-03', mood: 'neutral', home: { change: 0 } });
    expect(fish[0]!.moodResult?.mood).toBe('sad');
    expect(fish[0]!.change).toBeLessThan(0);
    expect(fish[1]!.stale).toBeUndefined();
    // Only A's +1 % moves the tank.
    expect(weatherFor(fish, market).change).toBeGreaterThan(0);
  });
});

describe('mixed currencies', () => {
  const inCurrency = (symbol: string, move: number, currency: string): MarketEntry => {
    const e = entry(symbol, move);
    return { ...e, quote: e.quote && { ...e.quote, currency } };
  };
  const market = new Map([
    ['AAPL', inCurrency('AAPL', 0.01, 'USD')],
    ['RY:TSX', inCurrency('RY:TSX', 0.01, 'CAD')],
    ['SONY', inCurrency('SONY', 0.01, 'JPY')],
  ]);
  const holdings = [holding('AAPL', 10), holding('RY:TSX', 10), holding('SONY', 10)];
  const money = { home: 'CAD', rates: new Map([['USD/CAD', 1.4]]) };

  it('values each fish in the home currency, once its rate is known', () => {
    const fish = buildFish(holdings, new Map(), market, money);
    const [aapl, ry, sony] = fish;
    const native = 10 * (aapl?.quote?.price ?? 0);
    expect(aapl?.home?.value).toBeCloseTo(native * 1.4);
    expect(ry?.home?.value).toBeCloseTo(native);
    expect(sony?.home).toBeUndefined(); // no JPY rate yet
    // The fish's own numbers stay in its own currency.
    expect(aapl?.change).toBeCloseTo(10 * (aapl!.quote!.price - aapl!.quote!.previousClose));
  });

  it('adds up the weather in CAD, leaving out fish without a rate', () => {
    const fish = buildFish(holdings, new Map(), market, money);
    const [aapl, ry] = fish;
    const expected = (aapl?.home?.change ?? 0) + (ry?.home?.change ?? 0);
    const weather = weatherFor(fish, market);
    expect(weather.change).toBeCloseTo(expected);
    // Same move everywhere, so the portfolio moved by that much too.
    expect(weather.changeRatio).toBeCloseTo(0.01);
  });
});
