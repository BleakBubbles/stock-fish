import type { StockFishDb } from './db';
import { lastSettledClose, marketOpenNow } from './market';
import type { MarketEntry } from './model';
import { type MarketDataProvider, ProviderError } from './providers';

/** Quotes refresh this often while the market is open (CLAUDE.md placeholder). */
export const QUOTE_INTERVAL = 15 * 60_000;
/** A symbol that failed isn't retried for this long. */
export const ERROR_RETRY = 15 * 60_000;
/** Daily bars to fetch: 60 returns need 61 closes, plus today's unfinished bar. */
export const HISTORY_DAYS = 62;

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
 * Does this symbol need a new quote? Every QUOTE_INTERVAL while the market is
 * open; once after each close has settled (for the final price); otherwise no.
 */
export function needsQuote(entry: MarketEntry | undefined, now: number, open: boolean): boolean {
  if (backingOff(entry, now)) return false;
  const at = fetchedAt(entry?.quoteAt, now);
  if (at === undefined) return true;
  if (open) return now - at >= QUOTE_INTERVAL;
  return at < lastSettledClose(now);
}

/** Does this symbol need new daily bars? Once per completed session. */
export function needsHistory(entry: MarketEntry | undefined, now: number): boolean {
  if (backingOff(entry, now)) return false;
  const at = fetchedAt(entry?.barsAt, now);
  if (at === undefined) return true;
  return at < lastSettledClose(now);
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
  /** Symbols that failed this run. */
  failed: string[];
}

/**
 * Fetch whatever is due for these symbols, one request at a time (the
 * provider paces itself). Quotes first, so moods appear quickly, then history.
 */
export async function refreshMarketData(
  db: StockFishDb,
  provider: MarketDataProvider,
  symbols: readonly string[],
  options: { now?: () => number; signal?: AbortSignal } = {},
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
  const recent = entries.flatMap((e) =>
    e?.quote && e.quoteAt !== undefined
      ? [{ marketOpen: e.quote.marketOpen, fetchedAt: e.quoteAt }]
      : [],
  );
  const open = marketOpenNow(now(), recent);

  type Job = { symbol: string; kind: 'quote' | 'history' };
  const jobs: Job[] = [
    ...unique
      .filter((_, i) => needsQuote(entries[i], now(), open))
      .map((symbol) => ({ symbol, kind: 'quote' as const })),
    ...unique
      .filter((_, i) => needsHistory(entries[i], now()))
      .map((symbol) => ({ symbol, kind: 'history' as const })),
  ];

  for (const job of jobs) {
    if (options.signal?.aborted) return { ...result, stop: 'aborted' };
    if (result.failed.includes(job.symbol)) continue;
    try {
      result.requests++;
      if (job.kind === 'quote') {
        const quote = await provider.getQuote(job.symbol);
        if (options.signal?.aborted) return { ...result, stop: 'aborted' };
        await save(job.symbol, { quote, quoteAt: now(), error: undefined });
      } else {
        const bars = await provider.getDailyHistory(job.symbol, HISTORY_DAYS);
        if (options.signal?.aborted) return { ...result, stop: 'aborted' };
        await save(job.symbol, { bars, barsAt: now(), error: undefined });
      }
    } catch (e) {
      const kind = e instanceof ProviderError ? e.kind : 'unknown';
      if (kind === 'auth' || kind === 'rate-limit') return { ...result, stop: kind };
      result.failed.push(job.symbol);
      await save(job.symbol, {
        error: { kind, message: e instanceof Error ? e.message : String(e), at: now() },
      });
    }
  }
  return result;
}
