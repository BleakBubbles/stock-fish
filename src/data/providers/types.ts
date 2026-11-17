/**
 * Market data provider interface (CLAUDE.md, firm rule 1).
 * Nothing outside src/data/providers/ calls a market data API directly.
 */

export interface Quote {
  symbol: string;
  price: number;
  previousClose: number;
  /** When the price was observed, in ms since the Unix epoch. */
  timestamp: number;
  /** Company or fund name, when the quote includes it. */
  name?: string;
  /**
   * Trading day the price belongs to, in the exchange's time zone
   * (YYYY-MM-DD). The mood engine ignores history bars from this day on, so
   * today's unfinished bar never counts towards typical volatility.
   */
  tradingDay?: string;
}

export interface DailyBar {
  /** Trading day in the exchange's time zone, ISO date (YYYY-MM-DD). */
  date: string;
  close: number;
}

export interface Profile {
  sector?: string;
  name?: string;
}

export interface MarketDataProvider {
  id: string;
  getQuote(symbol: string): Promise<Quote>;
  /**
   * Up to `days` daily bars, oldest first. During a trading session the last
   * bar can be today's unfinished one; callers that need completed days only
   * should drop bars dated on or after the quote's trading day.
   */
  getDailyHistory(symbol: string, days: number): Promise<DailyBar[]>;
  getProfile?(symbol: string): Promise<Profile>;
}

export type ProviderErrorKind =
  /** Key missing, wrong or revoked. */
  | 'auth'
  /** Too many requests for the plan's per-minute or per-day limit. */
  | 'rate-limit'
  /** The endpoint or symbol needs a higher plan. */
  | 'plan'
  /** The provider doesn't know the symbol. */
  | 'not-found'
  /** Request never got a response (offline, DNS, CORS). */
  | 'network'
  | 'unknown';

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;

  constructor(kind: ProviderErrorKind, message: string) {
    super(message);
    this.name = 'ProviderError';
    this.kind = kind;
  }
}
