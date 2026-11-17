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
}

export interface DailyBar {
  /** Trading day, ISO date (YYYY-MM-DD). */
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
  getDailyHistory(symbol: string, days: number): Promise<DailyBar[]>;
  getProfile?(symbol: string): Promise<Profile>;
}
