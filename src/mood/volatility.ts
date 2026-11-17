import { dailyReturns, sampleStdDev } from './stats';

/** A daily close. Structurally the same as the data layer's DailyBar. */
export interface Bar {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  close: number;
}

/** σ is measured over this many of the most recent daily returns. */
export const VOLATILITY_WINDOW = 60;

/** With fewer daily returns than this, σ is unknown and the fish stays neutral. */
export const MIN_RETURNS = 20;

/**
 * Bars for completed trading days before `asOf`, oldest first. Drops today's
 * unfinished bar (and anything later), sorts, and removes duplicate dates and
 * unusable closes. Without `asOf` every bar counts as completed.
 */
export function completedBars(bars: readonly Bar[], asOf?: string): Bar[] {
  const byDate = new Map<string, Bar>();
  for (const bar of bars) {
    if (asOf !== undefined && bar.date >= asOf) continue;
    if (!(bar.close > 0) || !Number.isFinite(bar.close)) continue;
    byDate.set(bar.date, bar);
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Typical daily volatility: the sample standard deviation of the last
 * `window` daily returns of completed days. Undefined when there are fewer
 * than MIN_RETURNS returns. Pass the trading day of today's quote as `asOf`
 * so today's own move doesn't count towards what is "typical".
 */
export function typicalVolatility(
  bars: readonly Bar[],
  asOf?: string,
  window = VOLATILITY_WINDOW,
): number | undefined {
  const closes = completedBars(bars, asOf).map((b) => b.close);
  const returns = dailyReturns(closes).slice(-window);
  if (returns.length < MIN_RETURNS) return undefined;
  const sigma = sampleStdDev(returns);
  return Number.isFinite(sigma) ? sigma : undefined;
}
