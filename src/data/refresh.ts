import { pairsNeeded } from './currency';
import type { StockFishDb } from './db';
import { type Exchange, US, lastSettledClose, marketStates, staleSince } from './market';
import type { FxEntry, MarketEntry } from './model';
import { type MarketDataProvider, ProviderError } from './providers';

/** Quotes refresh this often while their market is open (CLAUDE.md placeholder). */
export const QUOTE_INTERVAL = 15 * 60_000;
/**
 * A day-old price (a fund before tonight's price) is retried this often after
 * its market closes, for STALE_RETRY_FOR after the close has settled.
 */
export const STALE_RETRY = 60 * 60_000;
export const STALE_RETRY_FOR = 6 * 60 * 60_000;
/** A symbol that failed isn't retried for this long. */
export const ERROR_RETRY = 15 * 60_000;
/** Exchange rates refresh this often (totals only need a recent rate). */
export const FX_INTERVAL = 12 * 60 * 60_000;
/** Daily bars to fetch: 60 returns need 61 closes, plus today's unfinished bar. */
export const HISTORY_DAYS = 62;

/** Requests a day on Twelve Data's free plan. */
export const DAILY_REQUESTS = 800;
/** The share of them the schedule plans for; the rest covers exchange rates, retries and key tests. */
export const BUDGET_SHARE = 0.8;
/** Round-the-clock prices refresh at least this often, even if that's over budget. */
export const MAX_ROUND_THE_CLOCK_INTERVAL = 6 * 60 * 60_000;

const DAY = 24 * 60 * 60_000;

export interface RefreshPlan {
  /** How often round-the-clock symbols (crypto, currencies) refresh, in ms. */
  roundTheClock: number;
  /** The holdings need more requests a day than the plan's budget. */
  overBudget: boolean;
}

/**
 * How often round-the-clock symbols can refresh within the daily budget.
 * Each stock first gets what its trading day needs (a quote every
 * QUOTE_INTERVAL through its session, one after the close, one history
 * fetch); round-the-clock symbols share what's left (less a history fetch and a new-day quote
 * each), never faster than QUOTE_INTERVAL nor slower than
 * MAX_ROUND_THE_CLOCK_INTERVAL. One entry per symbol.
 */
export function refreshPlan(exchanges: readonly Exchange[]): RefreshPlan {
  const always = exchanges.filter((e) => e.days !== 'weekdays').length;
  const stockRequests = exchanges
    .filter((e) => e.days === 'weekdays')
    .reduce((sum, e) => sum + Math.ceil(((e.close - e.open) * 60_000) / QUOTE_INTERVAL) + 2, 0);
  const left = DAILY_REQUESTS * BUDGET_SHARE - stockRequests - 2 * always;
  if (always === 0) return { roundTheClock: QUOTE_INTERVAL, overBudget: left < 0 };
  const wanted = left > 0 ? (DAY * always) / left : Infinity;
  // Whole minutes, so the schedule reads plainly.
  const interval = Math.ceil(Math.max(QUOTE_INTERVAL, wanted) / 60_000) * 60_000;
  return {
    roundTheClock: Math.min(interval, MAX_ROUND_THE_CLOCK_INTERVAL),
    overBudget: interval > MAX_ROUND_THE_CLOCK_INTERVAL,
  };
}

/** Cached data from this provider, or undefined if it came from another one. */
export function usableEntry(
  entry: MarketEntry | undefined,
  providerId: string,
): MarketEntry | undefined {
  return entry?.provider === providerId ? entry : undefined;
}

function backingOff(entry: MarketEntry | undefined, now: number): boolean {
  // An error "from the future" (the clock moved back) doesn't block anything.
  return entry?.error !== undefined && entry.error.at <= now && now - entry.error.at < ERROR_RETRY;
}

/** Fetched in the future means the clock changed: treat as never fetched. */
const fetchedAt = (at: number | undefined, now: number) =>
  at === undefined || at > now ? undefined : at;

/**
 * Does this symbol need a new quote? Every `interval` while its market is
 * open; once after each close has settled (for the final price); otherwise no.
 * A day-old price (`stale`) is asked for again sooner: every QUOTE_INTERVAL
 * while open (crypto's new UTC day), and every STALE_RETRY for a while after
 * the close (a fund's price comes out in the evening).
 */
export function needsQuote(
  entry: MarketEntry | undefined,
  now: number,
  open: boolean,
  exchange: Exchange = US,
  interval = QUOTE_INTERVAL,
  stale = false,
): boolean {
  if (backingOff(entry, now)) return false;
  const at = fetchedAt(entry?.quoteAt, now);
  if (at === undefined) return true;
  if (open) return now - at >= (stale ? Math.min(interval, QUOTE_INTERVAL) : interval);
  const settled = lastSettledClose(now, exchange);
  if (at < settled) return true;
  return stale && now - at >= STALE_RETRY && now - settled < STALE_RETRY_FOR;
}

/** Does this symbol need new daily bars? Once per completed session of its market. */
export function needsHistory(
  entry: MarketEntry | undefined,
  now: number,
  exchange: Exchange = US,
): boolean {
  if (backingOff(entry, now)) return false;
  const at = fetchedAt(entry?.barsAt, now);
  if (at === undefined) return true;
  return at < lastSettledClose(now, exchange);
}

/** Does this currency pair need a new rate? Twice a day, after an error's back-off. */
export function needsRate(entry: FxEntry | undefined, now: number): boolean {
  if (entry?.error !== undefined && entry.error.at <= now && now - entry.error.at < ERROR_RETRY) {
    return false;
  }
  const at = fetchedAt(entry?.rate === undefined ? undefined : entry.at, now);
  return at === undefined || now - at >= FX_INTERVAL;
}

export type RefreshStop =
  /** Everything due was fetched (or nothing was due). */
  | 'done'
  /** The provider rejected the key: no point continuing. */
  | 'auth'
  /** Rate limit hit: try again on a later tick. */
  | 'rate-limit'
  /** The caller cancelled (provider or holdings changed). */
  | 'aborted';

export interface RefreshResult {
  stop: RefreshStop;
  requests: number;
  /** Symbols (or currency pairs) that failed this run. */
  failed: string[];
}

/**
 * Fetch whatever is due for these symbols, one request at a time (the
 * provider paces itself): quotes first, so moods appear quickly, then the
 * exchange rates totals need, then history.
 */
export async function refreshMarketData(
  db: StockFishDb,
  provider: MarketDataProvider,
  symbols: readonly string[],
  options: {
    now?: () => number;
    signal?: AbortSignal;
    /** Currency for totals: fetch rates from each quote currency into it. */
    home?: string;
  } = {},
): Promise<RefreshResult> {
  const now = options.now ?? Date.now;
  const unique = [...new Set(symbols)];
  const result: RefreshResult = { stop: 'done', requests: 0, failed: [] };

  const load = async (symbol: string) => usableEntry(await db.market.get(symbol), provider.id);
  const save = async (symbol: string, changes: Partial<MarketEntry>) => {
    const current = await load(symbol);
    await db.market.put({ ...current, ...changes, symbol, provider: provider.id });
  };

  const entries = await Promise.all(unique.map(load));
  // Each symbol on its own market's clock.
  const cached = new Map(unique.flatMap((symbol, i) => (entries[i] ? [[symbol, entries[i]]] : [])));
  const states = marketStates(now(), unique, cached);
  const stateOf = (symbol: string) => states.get(symbol) ?? { exchange: US, open: false };
  // Crypto and currencies never close: they refresh as often as the day's budget allows.
  const plan = refreshPlan(unique.map((symbol) => stateOf(symbol).exchange));

  const quoteJobs = unique.filter((symbol, i) => {
    const state = stateOf(symbol);
    const { open, exchange } = state;
    const interval = exchange.days === 'weekdays' ? QUOTE_INTERVAL : plan.roundTheClock;
    const stale = staleSince(entries[i]?.quote, state) !== undefined;
    return needsQuote(entries[i], now(), open, exchange, interval, stale);
  });
  const historyJobs = unique.filter((symbol, i) =>
    needsHistory(entries[i], now(), stateOf(symbol).exchange),
  );

  /** Run one request; false means stop the whole run (result.stop says why). */
  const attempt = async (
    label: string,
    task: () => Promise<void>,
    onError: (error: FxEntry['error'] & {}) => Promise<void>,
  ) => {
    if (options.signal?.aborted) {
      result.stop = 'aborted';
      return false;
    }
    try {
      result.requests++;
      await task();
      if (options.signal?.aborted) {
        result.stop = 'aborted';
        return false;
      }
    } catch (e) {
      const kind = e instanceof ProviderError ? e.kind : 'unknown';
      if (kind === 'auth' || kind === 'rate-limit') {
        result.stop = kind;
        return false;
      }
      result.failed.push(label);
      await onError({ kind, message: e instanceof Error ? e.message : String(e), at: now() });
    }
    return true;
  };

  // 1. Quotes, so moods appear quickly.
  for (const symbol of quoteJobs) {
    const ok = await attempt(
      symbol,
      async () => {
        const quote = await provider.getQuote(symbol);
        if (!options.signal?.aborted)
          await save(symbol, { quote, quoteAt: now(), error: undefined });
      },
      (error) => save(symbol, { error }),
    );
    if (!ok) return result;
  }

  // 2. Exchange rates into the home currency, so totals add up.
  const home = options.home;
  const getRate = provider.getExchangeRate?.bind(provider);
  if (home && getRate) {
    const quotes = await Promise.all(unique.map(load));
    const currencies = quotes.flatMap((e) => (e?.quote?.currency ? [e.quote.currency] : []));
    for (const pair of pairsNeeded(currencies, home)) {
      const stored = await db.fx.get(pair);
      const entry = stored?.provider === provider.id ? stored : undefined;
      if (!needsRate(entry, now())) continue;
      const [from = '', to = ''] = pair.split('/');
      const ok = await attempt(
        pair,
        async () => {
          const { rate } = await getRate(from, to);
          if (!options.signal?.aborted) {
            await db.fx.put({ pair, provider: provider.id, rate, at: now() });
          }
        },
        (error) =>
          db.fx.put({ ...entry, pair, provider: provider.id, error }).then(() => undefined),
      );
      if (!ok) return result;
    }
  }

  // 3. History, for the typical size of a day's move.
  for (const symbol of historyJobs) {
    if (result.failed.includes(symbol)) continue;
    const ok = await attempt(
      symbol,
      async () => {
        const bars = await provider.getDailyHistory(symbol, HISTORY_DAYS);
        if (!options.signal?.aborted) await save(symbol, { bars, barsAt: now(), error: undefined });
      },
      (error) => save(symbol, { error }),
    );
    if (!ok) return result;
  }
  return result;
}
