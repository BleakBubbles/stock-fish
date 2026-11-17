import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import type { MarketEntry } from './model';
import { providerFromSettings } from './providers';
import { type RefreshStop, refreshMarketData } from './refresh';
import { db, useHoldings, useSettings } from './store';

/** How often to check whether anything is due (the schedule decides what to fetch). */
const TICK = 60_000;

export type MarketStatus =
  | { state: 'no-provider' }
  | { state: 'updating' }
  | { state: 'idle'; stop: RefreshStop; failed: string[] };

/**
 * Keep cached quotes and history fresh for every held symbol, for as long as
 * the app is open. Mount once, near the top of the app.
 */
export function useMarketRefresh(): MarketStatus {
  const settings = useSettings();
  const holdings = useHoldings();
  const [status, setStatus] = useState<MarketStatus>({ state: 'updating' });

  const providerKey = settings
    ? `${settings.provider}:${settings.apiKeys[settings.provider] ?? ''}`
    : '';
  const provider = useMemo(
    () => (settings ? providerFromSettings(settings) : undefined),
    // Rebuild only when the provider or its key changes, not on every settings read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [providerKey],
  );
  const symbolKey = [...new Set(holdings?.map((h) => h.symbol) ?? [])].sort().join(',');

  useEffect(() => {
    if (!provider) return;
    const symbols = symbolKey ? symbolKey.split(',') : [];
    const controller = new AbortController();
    let running = false;

    const tick = async () => {
      if (running || symbols.length === 0) return;
      running = true;
      setStatus({ state: 'updating' });
      try {
        const result = await refreshMarketData(db, provider, symbols, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setStatus({ state: 'idle', stop: result.stop, failed: result.failed });
        }
      } finally {
        running = false;
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), TICK);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [provider, symbolKey]);

  return provider ? status : { state: 'no-provider' };
}

/** Cached market data for the current provider, by symbol. */
export function useMarketEntries(): Map<string, MarketEntry> | undefined {
  const settings = useSettings();
  const providerId = settings?.provider;
  return useLiveQuery(async () => {
    if (!providerId) return undefined;
    const rows = await db.market.toArray();
    return new Map(rows.filter((r) => r.provider === providerId).map((r) => [r.symbol, r]));
  }, [providerId]);
}
