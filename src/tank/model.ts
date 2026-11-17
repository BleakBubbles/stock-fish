/**
 * What the tank shows, derived from holdings, symbol profiles and cached
 * market data. Pure, so it's easy to test; the React hook lives in Tank.tsx.
 */
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
  /** Message from the last failed fetch, if any. */
  error?: string;
}

export function buildFish(
  holdings: readonly Holding[],
  profiles: ReadonlyMap<string, SymbolProfile>,
  market: ReadonlyMap<string, MarketEntry>,
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
    return {
      ...base,
      mood: moodResult.mood,
      state: 'ok',
      quote,
      moodResult,
      change: h.quantity * (quote.price - quote.previousClose),
    };
  });
}

/** Weather for a set of fish (only those with quotes count). */
export function weatherFor(
  fish: readonly FishView[],
  market: ReadonlyMap<string, MarketEntry>,
): WeatherResult {
  return portfolioWeather(
    fish.flatMap((f) =>
      f.quote
        ? [
            {
              quantity: f.quantity,
              price: f.quote.price,
              previousClose: f.quote.previousClose,
              history: market.get(f.symbol)?.bars ?? [],
              asOf: f.quote.tradingDay,
            },
          ]
        : [],
    ),
  );
}
