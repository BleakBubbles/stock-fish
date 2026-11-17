import {
  type DailyBar,
  type MarketDataProvider,
  type Profile,
  type Quote,
  ProviderError,
} from './types';

/** Fixture profiles; any other symbol gets a deterministic made-up series and no sector. */
export const MOCK_PROFILES: Readonly<Record<string, Profile>> = {
  AAPL: { name: 'Apple Inc.', sector: 'Technology' },
  MSFT: { name: 'Microsoft Corporation', sector: 'Technology' },
  GOOGL: { name: 'Alphabet Inc.', sector: 'Communication Services' },
  JPM: { name: 'JPMorgan Chase & Co.', sector: 'Financial Services' },
  O: { name: 'Realty Income Corporation', sector: 'Real Estate' },
  AMZN: { name: 'Amazon.com, Inc.', sector: 'Consumer Cyclical' },
  KO: { name: 'The Coca-Cola Company', sector: 'Consumer Defensive' },
  XOM: { name: 'Exxon Mobil Corporation', sector: 'Energy' },
  NEE: { name: 'NextEra Energy, Inc.', sector: 'Utilities' },
  CAT: { name: 'Caterpillar Inc.', sector: 'Industrials' },
  LIN: { name: 'Linde plc', sector: 'Basic Materials' },
  JNJ: { name: 'Johnson & Johnson', sector: 'Healthcare' },
  VTI: { name: 'Vanguard Total Stock Market ETF' },
};

/** Symbols the mock refuses, to exercise the not-found path. */
export const MOCK_UNKNOWN = 'NOPE';

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small seeded PRNG, uniform in [0, 1). */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Weekdays ending on (and including) `today`, oldest first. */
function weekdays(today: number, count: number): string[] {
  const days: string[] = [];
  for (let t = today; days.length < count; t -= 86_400_000) {
    const dow = new Date(t).getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(isoDate(t));
  }
  return days.reverse();
}

export interface MockOptions {
  /** Clock, for deterministic tests. */
  now?: () => number;
}

/**
 * Offline fixture provider. Each symbol gets a stable random walk with its own
 * volatility (0.5%–4% a day), so the mood engine sees a spread of moods. The
 * last bar is "today", and the quote's price equals it.
 */
export function createMockProvider(options: MockOptions = {}): MarketDataProvider {
  const now = options.now ?? Date.now;
  const HISTORY = 250;

  function series(symbol: string): DailyBar[] {
    const s = symbol.toUpperCase();
    if (s === MOCK_UNKNOWN) throw new ProviderError('not-found', `Unknown symbol ${s}`);
    const seed = hash(s);
    const rand = rng(seed);
    const sigma = 0.005 + ((seed % 1000) / 1000) * 0.035;
    let price = 20 + (seed % 480);
    return weekdays(now(), HISTORY).map((date) => {
      // Approximate normal from the sum of uniforms (Irwin–Hall, n = 12).
      let z = -6;
      for (let i = 0; i < 12; i++) z += rand();
      price = Math.max(1, price * (1 + sigma * z));
      return { date, close: Math.round(price * 100) / 100 };
    });
  }

  return {
    id: 'mock',

    async getQuote(symbol: string): Promise<Quote> {
      const [prev, last] = series(symbol).slice(-2);
      if (!prev || !last) throw new ProviderError('unknown', 'Mock series too short');
      return {
        symbol: symbol.toUpperCase(),
        price: last.close,
        previousClose: prev.close,
        timestamp: now(),
        name: MOCK_PROFILES[symbol.toUpperCase()]?.name,
        tradingDay: last.date,
        currency: 'USD',
      };
    },

    async getDailyHistory(symbol: string, days: number): Promise<DailyBar[]> {
      return series(symbol).slice(-days);
    },

    async getProfile(symbol: string): Promise<Profile> {
      const s = symbol.toUpperCase();
      if (s === MOCK_UNKNOWN) throw new ProviderError('not-found', `Unknown symbol ${s}`);
      return MOCK_PROFILES[s] ?? {};
    },
  };
}
