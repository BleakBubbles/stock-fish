import table from './sectors.json';
import { type SymbolProfile, normalizeSymbol } from './model';

/**
 * Where a symbol's sector came from, best first:
 * - user: chosen in the app ("which family is this fish?")
 * - provider: the market data provider's company profile (paid plans only on Twelve Data)
 * - builtin: src/data/sectors.json (S&P 500 + common funds; scripts/update-sectors.ts)
 */
export type SectorSource = 'user' | 'provider' | 'builtin';

export interface ResolvedSector {
  sector?: string;
  source?: SectorSource;
}

const builtin: Readonly<Record<string, string>> = table.sectors;

export function builtinSector(symbol: string): string | undefined {
  return builtin[normalizeSymbol(symbol)];
}

export function resolveSector(symbol: string, profile?: SymbolProfile): ResolvedSector {
  if (profile?.userSector) return { sector: profile.userSector, source: 'user' };
  if (profile?.sector) return { sector: profile.sector, source: 'provider' };
  const fromTable = builtinSector(symbol);
  if (fromTable) return { sector: fromTable, source: 'builtin' };
  return {};
}

export const SOURCE_LABEL: Record<SectorSource, string> = {
  user: 'your choice',
  provider: 'from your data provider',
  builtin: 'from the built-in list',
};
