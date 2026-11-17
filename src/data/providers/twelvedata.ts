import {
  type DailyBar,
  type MarketDataProvider,
  type Profile,
  type Quote,
  ProviderError,
  type ProviderErrorKind,
} from './types';

const BASE_URL = 'https://api.twelvedata.com';

export interface TwelveDataOptions {
  apiKey: string;
  /** Injectable for tests. */
  fetch?: typeof globalThis.fetch;
}

interface ErrorBody {
  status: 'error';
  code: number;
  message: string;
}

function isErrorBody(body: unknown): body is ErrorBody {
  return typeof body === 'object' && body !== null && (body as ErrorBody).status === 'error';
}

function kindForCode(code: number): ProviderErrorKind {
  if (code === 401) return 'auth';
  if (code === 429) return 'rate-limit';
  if (code === 403) return 'plan';
  if (code === 400 || code === 404) return 'not-found';
  return 'unknown';
}

function toNumber(value: unknown, field: string): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) throw new ProviderError('unknown', `Twelve Data: bad ${field}`);
  return n;
}

/**
 * Twelve Data adapter (https://twelvedata.com/docs). Free plan: 8 requests a
 * minute, 800 a day. Browser requests are allowed (CORS checked 2026-11-17),
 * so no relay is needed. /profile (sector) needs a paid plan; free keys get a
 * 403 for every symbol except a few showcase ones like AAPL.
 */
export function createTwelveDataProvider(options: TwelveDataOptions): MarketDataProvider {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);

  async function get(path: string, params: Record<string, string>): Promise<unknown> {
    const url = new URL(path, BASE_URL);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set('apikey', options.apiKey);

    let response: Response;
    try {
      response = await doFetch(url.toString());
    } catch (e) {
      throw new ProviderError('network', `Could not reach Twelve Data: ${(e as Error).message}`);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ProviderError(
        kindForCode(response.status),
        `Twelve Data returned HTTP ${response.status}`,
      );
    }
    if (isErrorBody(body)) throw new ProviderError(kindForCode(body.code), body.message);
    if (!response.ok) {
      throw new ProviderError(
        kindForCode(response.status),
        `Twelve Data returned HTTP ${response.status}`,
      );
    }
    return body;
  }

  return {
    id: 'twelvedata',

    async getQuote(symbol: string): Promise<Quote> {
      const body = (await get('/quote', { symbol })) as Record<string, unknown>;
      return {
        symbol: String(body.symbol ?? symbol),
        price: toNumber(body.close, 'close'),
        previousClose: toNumber(body.previous_close, 'previous_close'),
        // last_quote_at is the latest trade; timestamp is the bar's open.
        timestamp: toNumber(body.last_quote_at ?? body.timestamp, 'timestamp') * 1000,
        ...(typeof body.name === 'string' && body.name ? { name: body.name } : {}),
        ...(typeof body.datetime === 'string' && /^\d{4}-\d{2}-\d{2}/.test(body.datetime)
          ? { tradingDay: body.datetime.slice(0, 10) }
          : {}),
      };
    },

    async getDailyHistory(symbol: string, days: number): Promise<DailyBar[]> {
      const body = (await get('/time_series', {
        symbol,
        interval: '1day',
        outputsize: String(days),
      })) as { values?: { datetime: string; close: string }[] };
      const values = body.values ?? [];
      // Twelve Data returns newest first.
      return values
        .map((v) => ({ date: v.datetime.slice(0, 10), close: toNumber(v.close, 'close') }))
        .reverse();
    },

    async getProfile(symbol: string): Promise<Profile> {
      const body = (await get('/profile', { symbol })) as Record<string, unknown>;
      const sector = typeof body.sector === 'string' && body.sector ? body.sector : undefined;
      const name = typeof body.name === 'string' && body.name ? body.name : undefined;
      return { sector, name };
    },
  };
}
