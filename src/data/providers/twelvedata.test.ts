import { describe, expect, it } from 'vitest';
import { createTwelveDataProvider } from './twelvedata';
import { ProviderError } from './types';
import type { Throttle } from './throttle';

const NO_THROTTLE: Throttle = { run: (task) => task() };

function fakeFetch(status: number, body: unknown, seen: string[] = []): typeof fetch {
  return (async (url: string) => {
    seen.push(url);
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
}

// Shapes taken from real responses (demo key, 2026-11-17), trimmed.
const QUOTE = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  datetime: '2026-11-17',
  timestamp: 1794925800,
  last_quote_at: 1794934620,
  close: '351.62',
  previous_close: '352.78000',
  is_market_open: true,
  currency: 'USD',
  exchange: 'NASDAQ',
  mic_code: 'XNGS',
};

const SERIES = {
  meta: { symbol: 'AAPL', interval: '1day' },
  values: [
    { datetime: '2026-11-17', close: '351.62' },
    { datetime: '2026-11-16', close: '352.78000' },
  ],
  status: 'ok',
};

describe('twelvedata provider', () => {
  it('parses a quote and sends the key', async () => {
    const seen: string[] = [];
    const p = createTwelveDataProvider({
      throttle: NO_THROTTLE,
      apiKey: 'KEY',
      fetch: fakeFetch(200, QUOTE, seen),
    });
    expect(await p.getQuote('AAPL')).toEqual({
      symbol: 'AAPL',
      price: 351.62,
      previousClose: 352.78,
      timestamp: 1794934620000,
      name: 'Apple Inc.',
      tradingDay: '2026-11-17',
      marketOpen: true,
      currency: 'USD',
      exchange: 'NASDAQ',
      mic: 'XNGS',
    });
    const url = new URL(seen[0]!);
    expect(url.pathname).toBe('/quote');
    expect(url.searchParams.get('symbol')).toBe('AAPL');
    expect(url.searchParams.get('apikey')).toBe('KEY');
  });

  it('returns history oldest first', async () => {
    const p = createTwelveDataProvider({
      throttle: NO_THROTTLE,
      apiKey: 'K',
      fetch: fakeFetch(200, SERIES),
    });
    expect(await p.getDailyHistory('AAPL', 2)).toEqual([
      { date: '2026-11-16', close: 352.78 },
      { date: '2026-11-17', close: 351.62 },
    ]);
  });

  it('parses a profile', async () => {
    const p = createTwelveDataProvider({
      throttle: NO_THROTTLE,
      apiKey: 'K',
      fetch: fakeFetch(200, { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' }),
    });
    expect(await p.getProfile!('AAPL')).toEqual({ name: 'Apple Inc.', sector: 'Technology' });
  });

  it.each([
    [401, 'auth'],
    [429, 'rate-limit'],
    [403, 'plan'],
    [404, 'not-found'],
    [400, 'not-found'],
    [500, 'unknown'],
  ])('maps error code %i to %s', async (code, kind) => {
    const p = createTwelveDataProvider({
      throttle: NO_THROTTLE,
      apiKey: 'K',
      fetch: fakeFetch(code, { code, message: 'nope', status: 'error' }),
    });
    await expect(p.getQuote('X')).rejects.toMatchObject({ kind, message: 'nope' });
  });

  it('maps an error body sent with HTTP 200', async () => {
    const p = createTwelveDataProvider({
      throttle: NO_THROTTLE,
      apiKey: 'K',
      fetch: fakeFetch(200, { code: 401, message: 'bad key', status: 'error' }),
    });
    await expect(p.getQuote('X')).rejects.toMatchObject({ kind: 'auth' });
  });

  it('maps a failed request to a network error', async () => {
    const p = createTwelveDataProvider({
      throttle: NO_THROTTLE,
      apiKey: 'K',
      fetch: (async () => {
        throw new TypeError('Failed to fetch');
      }) as typeof fetch,
    });
    const err = await p.getQuote('X').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err).toMatchObject({ kind: 'network' });
  });

  it('rejects a quote with a missing price', async () => {
    const p = createTwelveDataProvider({
      throttle: NO_THROTTLE,
      apiKey: 'K',
      fetch: fakeFetch(200, { ...QUOTE, close: undefined }),
    });
    await expect(p.getQuote('AAPL')).rejects.toBeInstanceOf(ProviderError);
  });
});

describe('twelvedata exchange rates', () => {
  it('asks /exchange_rate for the pair and parses the rate', async () => {
    const seen: string[] = [];
    const p = createTwelveDataProvider({
      throttle: NO_THROTTLE,
      apiKey: 'KEY',
      fetch: fakeFetch(200, { symbol: 'USD/CAD', rate: 1.3874, timestamp: 1794934620 }, seen),
    });
    expect(await p.getExchangeRate?.('USD', 'CAD')).toEqual({
      from: 'USD',
      to: 'CAD',
      rate: 1.3874,
      timestamp: 1794934620_000,
    });
    expect(seen[0]).toContain('/exchange_rate?symbol=USD%2FCAD');
  });
});
