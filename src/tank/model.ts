/**
 * What the tank shows, derived from holdings, symbol profiles and cached
 * market data. Pure, so it's easy to test; the React hook lives in Tank.tsx.
 */
import { type RateTable, homeFactor } from '../data/currency';
import type { Holding, MarketEntry, SymbolProfile } from '../data/model';
import type { Quote } from '../data/providers/types';
import { resolveSector } from '../data/sectors';
import { type MoodResult, type WeatherResult, assessMood, portfolioWeather } from '../mood';
import type { Mood } from '../mood/types';
import { type Hex, fishColours } from '../theme';
import { bodyForSector } from '../theme/bodies';
import type { Body } from '../theme/sprites';

export type FishDataState =
  /** Quote available: mood and numbers are real. */
  | 'ok'
  /** Nothing fetched yet. */
  | 'loading'
  /** The last fetch for this symbol failed and nothing usable is cached. */
  | 'error';

export interface FishView {
  /** The holding's id: one fish per holding. */
  id: string;
  symbol: string;
  name?: string;
  quantity: number;
  penId: string;
  body: Body;
  primary: Hex;
  secondary: Hex;
  mood: Mood;
  state: FishDataState;
  quote?: Quote;
  /** Mood details, when there is a quote. */
  moodResult?: MoodResult;
  /** Today's change in value for this holding (quantity × price move). */
  change?: number;
  /**
   * The price is a day old (from this trading day, before its market's
   * latest): a fund before tonight's price, a lagging quote. The fish sleeps,
   * its mood is calm, and its move counts as nothing today; `change` and
   * `moodResult` are that earlier day's.
   */
  stale?: string;
  /** Message from the last failed fetch, if any. */
  error?: string;
  /**
   * The holding in the home currency, for totals: set once there's a quote
   * and an exchange rate. `factor` turns a price into home currency.
   */
  home?: { factor: number; value: number; change: number };
}

/** The currency totals are shown in, and the rates to get there. */
export interface Money {
  home: string;
  rates: RateTable;
}

export function buildFish(
  holdings: readonly Holding[],
  profiles: ReadonlyMap<string, SymbolProfile>,
  market: ReadonlyMap<string, MarketEntry>,
  money?: Money,
  /** The quote's trading day when it's a day old (see FishView.stale). */
  staleSince?: (symbol: string, quote: Quote) => string | undefined,
): FishView[] {
  return holdings.map((h) => {
    const profile = profiles.get(h.symbol);
    const entry = market.get(h.symbol);
    const { primary, secondary } = fishColours(h);
    const base = {
      id: h.id,
      symbol: h.symbol,
      name: profile?.name ?? entry?.quote?.name,
      quantity: h.quantity,
      penId: h.penId,
      body: bodyForSector(resolveSector(h.symbol, profile).sector),
      primary,
      secondary,
      error: entry?.error?.message,
    };
    const quote = entry?.quote;
    if (!quote) {
      return { ...base, mood: 'neutral', state: entry?.error ? 'error' : 'loading' };
    }
    const moodResult = assessMood({
      price: quote.price,
      previousClose: quote.previousClose,
      history: entry.bars ?? [],
      asOf: quote.tradingDay,
    });
    const change = h.quantity * (quote.price - quote.previousClose);
    const factor = money ? homeFactor(quote.currency, money.home, money.rates) : 1;
    const stale = staleSince?.(h.symbol, quote);
    return {
      ...base,
      mood: stale ? 'neutral' : moodResult.mood,
      state: 'ok',
      quote,
      moodResult,
      change,
      ...(stale && { stale }),
      ...(factor !== undefined && {
        home: {
          factor,
          value: h.quantity * quote.price * factor,
          change: stale ? 0 : change * factor,
        },
      }),
    };
  });
}

/**
 * Weather for a set of fish, in the home currency. Only fish with a quote and
 * an exchange rate count. Each price is converted at today's rate, so the
 * change is the stocks' own move (not the currency's).
 */
export function weatherFor(
  fish: readonly FishView[],
  market: ReadonlyMap<string, MarketEntry>,
): WeatherResult {
  return portfolioWeather(
    fish.flatMap((f) =>
      f.quote && f.home
        ? [
            {
              quantity: f.quantity,
              price: f.quote.price * f.home.factor,
              // A day-old price hasn't moved today.
              previousClose: (f.stale ? f.quote.price : f.quote.previousClose) * f.home.factor,
              history: market.get(f.symbol)?.bars ?? [],
              asOf: f.quote.tradingDay,
            },
          ]
        : [],
    ),
  );
}
