import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { StockFishDb } from './db';
import type { MarketEntry } from './model';
import { createMockProvider } from './providers/mock';
import { type MarketDataProvider, ProviderError } from './providers/types';
import {
  ERROR_RETRY,
  FX_INTERVAL,
  HISTORY_DAYS,
  QUOTE_INTERVAL,
  needsHistory,
  needsQuote,
  needsRate,
  refreshMarketData,
  usableEntry,
} from './refresh';

// Tuesday 2026-11-17, New York on EST (UTC−5).
const at = (h: number, m = 0, day = 17) => Date.UTC(2026, 10, day, h + 5, m);

const entry = (changes: Partial<MarketEntry>): MarketEntry => ({
  symbol: 'X',
  provider: 'mock',
  ...changes,
});

describe('needsQuote', () => {
  it('fetches when there is nothing cached', () => {
    expect(needsQuote(undefined, at(11), true)).toBe(true);
  });

  it('refreshes every 15 minutes while open', () => {
    const e = entry({ quoteAt: at(11) });
    expect(needsQuote(e, at(11) + QUOTE_INTERVAL - 1, true)).toBe(false);
    expect(needsQuote(e, at(11) + QUOTE_INTERVAL, true)).toBe(true);
  });

  it('fetches once after the close settles, then waits', () => {
    expect(needsQuote(entry({ quoteAt: at(15, 55) }), at(16, 10), false)).toBe(false);
    expect(needsQuote(entry({ quoteAt: at(15, 55) }), at(16, 25), false)).toBe(true);
    expect(needsQuote(entry({ quoteAt: at(16, 25) }), at(22), false)).toBe(false);
    // Overnight and the next morning before the open: still fine.
    expect(needsQuote(entry({ quoteAt: at(16, 25) }), at(9, 0, 18), false)).toBe(false);
  });

  it('backs off after an error', () => {
    const e = entry({ error: { kind: 'network', message: 'x', at: at(11) } });
    expect(needsQuote(e, at(11) + ERROR_RETRY - 1, true)).toBe(false);
    expect(needsQuote(e, at(11) + ERROR_RETRY, true)).toBe(true);
  });
});

describe('clock changes', () => {
  it('treats data or errors stamped in the future as stale', () => {
    const future = at(11, 0, 21);
    expect(needsQuote(entry({ quoteAt: future }), at(11), true)).toBe(true);
    expect(needsHistory(entry({ barsAt: future }), at(11))).toBe(true);
    const e = entry({ quoteAt: at(10), error: { kind: 'network', message: 'x', at: future } });
    expect(needsQuote(e, at(11), true)).toBe(true);
  });
});

describe('needsHistory', () => {
  it('refetches once per completed session', () => {
    expect(needsHistory(undefined, at(11))).toBe(true);
    // Fetched yesterday evening: good for all of today's session.
    expect(needsHistory(entry({ barsAt: at(18, 0, 16) }), at(15))).toBe(false);
    // Fetched during today's session: has today's unfinished bar; refetch after the close.
    expect(needsHistory(entry({ barsAt: at(11) }), at(16, 30))).toBe(true);
  });
});

describe('usableEntry', () => {
  it('ignores data from another provider', () => {
    expect(usableEntry(entry({ provider: 'twelvedata' }), 'mock')).toBeUndefined();
    expect(usableEntry(entry({}), 'mock')).toBeDefined();
  });
});

describe('refreshMarketData', () => {
  let db: StockFishDb;
  beforeEach(() => {
    db = new StockFishDb(`test-${crypto.randomUUID()}`);
  });

  function counting(provider: MarketDataProvider) {
    const calls: string[] = [];
    return {
      calls,
      provider: {
        ...provider,
        getQuote: (s: string) => (calls.push(`quote:${s}`), provider.getQuote(s)),
        getDailyHistory: (s: string, d: number) => (
          calls.push(`history:${s}:${d}`),
          provider.getDailyHistory(s, d)
        ),
      } satisfies MarketDataProvider,
    };
  }

  it('fetches quotes first, then history, once per symbol', async () => {
    const now = at(11);
    const { provider, calls } = counting(createMockProvider({ now: () => now }));
    const result = await refreshMarketData(db, provider, ['AAPL', 'KO', 'AAPL'], {
      now: () => now,
    });
    expect(result).toEqual({ stop: 'done', requests: 4, failed: [] });
    expect(calls).toEqual([
      'quote:AAPL',
      'quote:KO',
      `history:AAPL:${HISTORY_DAYS}`,
      `history:KO:${HISTORY_DAYS}`,
    ]);
    const cached = await db.market.get('AAPL');
    expect(cached).toMatchObject({ provider: 'mock', quoteAt: now, barsAt: now });
    expect(cached?.bars).toHaveLength(HISTORY_DAYS);

    // Nothing is due a minute later.
    calls.length = 0;
    await refreshMarketData(db, provider, ['AAPL', 'KO'], { now: () => now + 60_000 });
    expect(calls).toEqual([]);
  });

  it('records per-symbol errors and carries on', async () => {
    const { provider } = counting(createMockProvider());
    const result = await refreshMarketData(db, provider, ['NOPE', 'KO'], { now: () => at(11) });
    expect(result.failed).toEqual(['NOPE']);
    expect((await db.market.get('NOPE'))?.error?.kind).toBe('not-found');
    expect((await db.market.get('KO'))?.quote).toBeDefined();
  });

  it('stops on a rejected key or rate limit without marking symbols', async () => {
    const failing: MarketDataProvider = {
      ...createMockProvider(),
      getQuote: async () => {
        throw new ProviderError('rate-limit', 'slow');
      },
    };
    const result = await refreshMarketData(db, failing, ['AAPL', 'KO'], { now: () => at(11) });
    expect(result).toMatchObject({ stop: 'rate-limit', requests: 1 });
    expect(await db.market.count()).toBe(0);
  });

  it('stops when aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await refreshMarketData(db, createMockProvider(), ['AAPL'], {
      signal: controller.signal,
    });
    expect(result.stop).toBe('aborted');
  });

  it('refetches everything after switching provider', async () => {
    const now = at(11);
    await refreshMarketData(db, createMockProvider({ now: () => now }), ['KO'], { now: () => now });
    const other = counting({ ...createMockProvider({ now: () => now }), id: 'other' });
    await refreshMarketData(db, other.provider, ['KO'], { now: () => now });
    expect(other.calls).toHaveLength(2);
    expect((await db.market.get('KO'))?.provider).toBe('other');
  });
});

describe('exchange rates in the refresh', () => {
  let db: StockFishDb;
  beforeEach(() => {
    db = new StockFishDb(`test-${crypto.randomUUID()}`);
  });

  it('fetches each foreign currency into home, between quotes and history, twice a day', async () => {
    const calls: string[] = [];
    const mock = createMockProvider({ now: () => at(12) });
    const provider: MarketDataProvider = {
      ...mock,
      getQuote: (s) => (calls.push(`quote:${s}`), mock.getQuote(s)),
      getDailyHistory: (s, d) => (calls.push(`history:${s}`), mock.getDailyHistory(s, d)),
      getExchangeRate: (f, t) => (calls.push(`fx:${f}/${t}`), mock.getExchangeRate!(f, t)),
    };
    const symbols = ['AAPL', 'RY:TSX', 'VOD:LSE'];
    await refreshMarketData(db, provider, symbols, { now: () => at(12), home: 'CAD' });
    expect(calls.filter((c) => c.startsWith('fx:'))).toEqual(['fx:GBP/CAD', 'fx:USD/CAD']);
    // Rates come after every quote and before any history.
    const firstFx = calls.findIndex((c) => c.startsWith('fx:'));
    expect(calls.slice(0, firstFx).every((c) => c.startsWith('quote:'))).toBe(true);
    expect(calls.slice(firstFx + 2).every((c) => c.startsWith('history:'))).toBe(true);
    expect((await db.fx.get('USD/CAD'))?.rate).toBeCloseTo(1 / 0.72);

    calls.length = 0;
    await refreshMarketData(db, provider, symbols, { now: () => at(14), home: 'CAD' });
    expect(calls.filter((c) => c.startsWith('fx:'))).toEqual([]);
  });

  it('needs a rate when missing, stale, or after an error has backed off', () => {
    const fx = (changes: object) => ({ pair: 'USD/CAD', provider: 'mock', ...changes });
    expect(needsRate(undefined, at(12))).toBe(true);
    expect(needsRate(fx({ rate: 1.4, at: at(11) }), at(12))).toBe(false);
    expect(needsRate(fx({ rate: 1.4, at: at(11) }), at(11) + FX_INTERVAL)).toBe(true);
    const error = { kind: 'network' as const, message: 'x', at: at(12) };
    expect(needsRate(fx({ error }), at(12) + 60_000)).toBe(false);
    expect(needsRate(fx({ error }), at(12) + ERROR_RETRY)).toBe(true);
  });
});
