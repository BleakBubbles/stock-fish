import { useLiveQuery } from 'dexie-react-hooks';
import { StockFishDb } from './db';
import type { Holding, Pen, Settings, SymbolProfile } from './model';
import { createRepo } from './repo';

/** The app's database and repository. Tests build their own with createRepo. */
export const db = new StockFishDb();
export const repo = createRepo(db);

/** Live views of storage. Each is undefined until the first read finishes. */

export function usePens(): Pen[] | undefined {
  return useLiveQuery(async () => {
    const pens = await db.pens.toArray();
    return pens.sort((a, b) => a.createdAt - b.createdAt);
  });
}

export function useHoldings(): Holding[] | undefined {
  return useLiveQuery(async () => {
    const holdings = await db.holdings.toArray();
    return holdings.sort((a, b) => a.symbol.localeCompare(b.symbol));
  });
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => repo.getSettings());
}

export function useProfiles(): Map<string, SymbolProfile> | undefined {
  return useLiveQuery(async () => {
    const profiles = await db.profiles.toArray();
    return new Map(profiles.map((p) => [p.symbol, p]));
  });
}
