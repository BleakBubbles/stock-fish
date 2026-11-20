/**
 * Which holdings move together (docs/SPEC.md, "Organizing fish": correlation).
 * Pure, like the rest of the mood engine.
 *
 * 1. Daily returns of completed days, the last VOLATILITY_WINDOW of them.
 * 2. The market model: most stocks rise and fall with the market, which would
 *    put everything in one group, so each holding's return is first regressed
 *    on the average of the others' (its beta to "the market" as this
 *    portfolio sees it), keeping what's left. Needs MIN_FOR_MARKET holdings;
 *    with fewer, plain returns are used.
 * 3. Pearson correlation over the days two holdings share (at least
 *    MIN_RETURNS of them).
 * 4. Average-linkage hierarchical clustering (UPGMA): merge the two groups
 *    whose members correlate best on average, until no pair of groups
 *    averages TOGETHER or more.
 */
import { dailyReturns } from './stats';
import { type Bar, MIN_RETURNS, VOLATILITY_WINDOW, completedBars } from './volatility';

/** Groups merge while their members' average correlation is at least this. */
export const TOGETHER = 0.5;

/** Fewer holdings than this with history: no market to take out, so plain returns are compared. */
export const MIN_FOR_MARKET = 5;

/** Daily returns by date: date → return from the previous completed day's close. */
export type ReturnSeries = Map<string, number>;

/** The last `window` daily returns of completed days, keyed by the day each return ends on. */
export function returnSeries(
  bars: readonly Bar[],
  asOf?: string,
  window = VOLATILITY_WINDOW,
): ReturnSeries {
  const done = completedBars(bars, asOf);
  const returns = dailyReturns(done.map((b) => b.close));
  const out: ReturnSeries = new Map();
  returns.slice(-window).forEach((r, i, recent) => {
    const bar = done[done.length - recent.length + i];
    if (bar && Number.isFinite(r)) out.set(bar.date, r);
  });
  return out;
}

/** Pearson correlation over the dates both series have; undefined with fewer than `minShared`. */
export function correlation(
  a: ReturnSeries,
  b: ReturnSeries,
  minShared = MIN_RETURNS,
): number | undefined {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [date, x] of a) {
    const y = b.get(date);
    if (y !== undefined) {
      xs.push(x);
      ys.push(y);
    }
  }
  if (xs.length < minShared) return undefined;
  const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = (xs[i] ?? 0) - mx;
    const dy = (ys[i] ?? 0) - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (!(sxx > 0) || !(syy > 0)) return undefined;
  return Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
}

/**
 * Each series with the market's move taken out: regressed on the average
 * return of all the other series that day (leave-one-out, so a holding isn't
 * compared with itself), keeping the residuals. Unchanged when there are
 * fewer than MIN_FOR_MARKET series.
 */
export function marketAdjusted(
  series: ReadonlyMap<string, ReturnSeries>,
): Map<string, ReturnSeries> {
  if (series.size < MIN_FOR_MARKET) return new Map(series);
  // Sum and count of returns per date, to take each series' own out.
  const sum = new Map<string, number>();
  const count = new Map<string, number>();
  for (const s of series.values()) {
    for (const [date, r] of s) {
      sum.set(date, (sum.get(date) ?? 0) + r);
      count.set(date, (count.get(date) ?? 0) + 1);
    }
  }
  const out = new Map<string, ReturnSeries>();
  for (const [symbol, s] of series) {
    const pairs: [string, number, number][] = [];
    for (const [date, r] of s) {
      const others = (count.get(date) ?? 0) - 1;
      // The market needs a couple of other holdings that day.
      if (others >= 2) pairs.push([date, r, ((sum.get(date) ?? 0) - r) / others]);
    }
    if (pairs.length < MIN_RETURNS) {
      out.set(symbol, new Map());
      continue;
    }
    const mr = pairs.reduce((a, [, r]) => a + r, 0) / pairs.length;
    const mm = pairs.reduce((a, [, , m]) => a + m, 0) / pairs.length;
    let cov = 0;
    let varM = 0;
    for (const [, r, m] of pairs) {
      cov += (r - mr) * (m - mm);
      varM += (m - mm) ** 2;
    }
    const beta = varM > 0 ? cov / varM : 0;
    const alpha = mr - beta * mm;
    out.set(symbol, new Map(pairs.map(([date, r, m]) => [date, r - alpha - beta * m])));
  }
  return out;
}

/**
 * Average-linkage hierarchical clustering: start with every id alone, and
 * repeatedly merge the two clusters whose cross pairs have the highest mean
 * correlation (over the pairs that have one), while it's at least `threshold`.
 */
export function averageLinkage(
  ids: readonly string[],
  corr: (a: string, b: string) => number | undefined,
  threshold = TOGETHER,
): string[][] {
  const clusters = ids.map((id) => [id]);
  const link = (a: string[], b: string[]): number | undefined => {
    let total = 0;
    let n = 0;
    for (const x of a) {
      for (const y of b) {
        const c = corr(x, y);
        if (c !== undefined) {
          total += c;
          n++;
        }
      }
    }
    return n ? total / n : undefined;
  };
  for (;;) {
    let best: { i: number; j: number; c: number } | undefined;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const c = link(clusters[i] ?? [], clusters[j] ?? []);
        if (c !== undefined && c >= threshold && (!best || c > best.c)) best = { i, j, c };
      }
    }
    if (!best) return clusters;
    const merged = [...(clusters[best.i] ?? []), ...(clusters[best.j] ?? [])];
    clusters.splice(best.j, 1);
    clusters.splice(best.i, 1, merged);
  }
}

export interface Kinship {
  /** Groups of two or more symbols that move together, in input order within each. */
  groups: { symbols: string[]; /** Mean correlation between its members. */ tightness: number }[];
  /** Symbols with enough history that move with no one. */
  alone: string[];
  /** Symbols without enough history to tell. */
  unknown: string[];
  /** For each symbol, the one it moves most with, if any is known. */
  closest: Map<string, { symbol: string; correlation: number }>;
}

/**
 * Which of these holdings move together. `histories` is keyed by symbol (one
 * entry per symbol, however many fish it has); `asOf` drops today's
 * unfinished bar, as for volatility.
 */
export function kinship(
  histories: ReadonlyMap<string, { bars: readonly Bar[]; asOf?: string }>,
  threshold = TOGETHER,
): Kinship {
  const raw = new Map<string, ReturnSeries>();
  const unknown: string[] = [];
  for (const [symbol, { bars, asOf }] of histories) {
    const s = returnSeries(bars, asOf);
    if (s.size >= MIN_RETURNS) raw.set(symbol, s);
    else unknown.push(symbol);
  }
  const series = marketAdjusted(raw);
  const symbols = [...raw.keys()];
  const cache = new Map<string, number | undefined>();
  const corr = (a: string, b: string) => {
    const key = a < b ? `${a}\n${b}` : `${b}\n${a}`;
    if (!cache.has(key)) {
      cache.set(key, correlation(series.get(a) ?? new Map(), series.get(b) ?? new Map()));
    }
    return cache.get(key);
  };

  const closest = new Map<string, { symbol: string; correlation: number }>();
  for (const a of symbols) {
    for (const b of symbols) {
      const c = a === b ? undefined : corr(a, b);
      if (c === undefined) continue;
      const best = closest.get(a);
      if (!best || c > best.correlation) closest.set(a, { symbol: b, correlation: c });
    }
  }

  const groups: Kinship['groups'] = [];
  const alone: string[] = [];
  for (const cluster of averageLinkage(symbols, corr, threshold)) {
    if (cluster.length < 2) {
      alone.push(...cluster);
      continue;
    }
    const pairs = cluster.flatMap((a, i) => cluster.slice(i + 1).map((b) => corr(a, b)));
    const known = pairs.filter((c): c is number => c !== undefined);
    const ordered = symbols.filter((s) => cluster.includes(s));
    groups.push({
      symbols: ordered,
      tightness: known.length ? known.reduce((a, c) => a + c, 0) / known.length : threshold,
    });
  }
  return { groups, alone, unknown, closest };
}

/** How closely a correlation says two holdings move together, in words. */
export function togetherWords(correlation: number): string {
  if (correlation >= 0.8) return 'Very closely';
  if (correlation >= 0.6) return 'Closely';
  if (correlation >= 0.4) return 'Somewhat';
  if (correlation >= 0.2) return 'Loosely';
  return 'Hardly';
}
