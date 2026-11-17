import { sampleStdDev, simpleReturn } from './stats';
import { DEFAULT_THRESHOLDS, MIN_SIGMA, type TierThresholds, tierFor } from './tiers';
import type { Mood } from './types';
import { type Bar, MIN_RETURNS, VOLATILITY_WINDOW, completedBars } from './volatility';

/** Tank-level weather, best to worst. Same order as the mood tiers. */
export const WEATHERS = ['sunny', 'fair', 'calm', 'rainy', 'stormy'] as const;
export type Weather = (typeof WEATHERS)[number];

const WEATHER_FOR_MOOD: Record<Mood, Weather> = {
  ecstatic: 'sunny',
  happy: 'fair',
  neutral: 'calm',
  uneasy: 'rainy',
  sad: 'stormy',
};

/**
 * Days where holdings covering less than this share of the portfolio have a
 * return (new listings, different exchange holidays) are left out of σ.
 */
export const MIN_DAY_COVERAGE = 0.5;

export interface Position {
  quantity: number;
  price: number;
  previousClose: number;
  history: readonly Bar[];
  /** Trading day of `price`; bars on or after it are ignored for σ. */
  asOf?: string;
}

export type WeatherReason =
  | 'ok'
  /** No position with a usable quote. */
  | 'empty'
  /** Fewer than MIN_RETURNS days of combined history. */
  | 'short-history'
  | 'flat-history';

export interface WeatherResult {
  weather: Weather;
  reason: WeatherReason;
  /** Today's change in value, in price units (mixed currencies are not converted yet). */
  change: number;
  /** Today's portfolio return, e.g. 0.004 for +0.4 %. 0 when empty. */
  changeRatio: number;
  /** Typical daily volatility of the portfolio, when known. */
  sigma?: number;
  z?: number;
}

/**
 * Portfolio weather for a set of positions (a pen, several pens or all). Like
 * a fish's mood, it scales today's move by what is typical, so a calm tank is
 * the usual state: today's portfolio return ÷ σ of the portfolio's daily
 * returns over the last 60 days, weighting holdings by yesterday's value.
 */
export function portfolioWeather(
  positions: readonly Position[],
  thresholds: TierThresholds = DEFAULT_THRESHOLDS,
): WeatherResult {
  const usable = positions.filter(
    (p) =>
      p.quantity > 0 &&
      Number.isFinite(p.quantity) &&
      Number.isFinite(simpleReturn(p.previousClose, p.price)),
  );
  const baseValue = usable.reduce((sum, p) => sum + p.quantity * p.previousClose, 0);
  if (usable.length === 0 || !(baseValue > 0)) {
    return { weather: 'calm', reason: 'empty', change: 0, changeRatio: 0 };
  }

  const change = usable.reduce((sum, p) => sum + p.quantity * (p.price - p.previousClose), 0);
  const changeRatio = change / baseValue;

  const sigma = portfolioVolatility(usable, baseValue);
  if (sigma === undefined) {
    return { weather: 'calm', reason: 'short-history', change, changeRatio };
  }
  if (sigma < MIN_SIGMA) {
    return { weather: 'calm', reason: 'flat-history', change, changeRatio, sigma };
  }
  const z = changeRatio / sigma;
  return {
    weather: WEATHER_FOR_MOOD[tierFor(z, thresholds)],
    reason: 'ok',
    change,
    changeRatio,
    sigma,
    z,
  };
}

/** σ of the value-weighted daily portfolio return over the last VOLATILITY_WINDOW days. */
function portfolioVolatility(
  positions: readonly Position[],
  baseValue: number,
): number | undefined {
  // date → [weighted return sum, weight covered]
  const days = new Map<string, [number, number]>();
  for (const p of positions) {
    const weight = (p.quantity * p.previousClose) / baseValue;
    const bars = completedBars(p.history, p.asOf);
    bars.forEach((bar, i) => {
      const prev = bars[i - 1];
      if (!prev) return;
      const r = simpleReturn(prev.close, bar.close);
      if (!Number.isFinite(r)) return;
      const day = days.get(bar.date) ?? [0, 0];
      day[0] += weight * r;
      day[1] += weight;
      days.set(bar.date, day);
    });
  }

  const returns = [...days.entries()]
    .filter(([, [, covered]]) => covered >= MIN_DAY_COVERAGE)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, [sum, covered]]) => sum / covered)
    .slice(-VOLATILITY_WINDOW);
  if (returns.length < MIN_RETURNS) return undefined;
  const sigma = sampleStdDev(returns);
  return Number.isFinite(sigma) ? sigma : undefined;
}
