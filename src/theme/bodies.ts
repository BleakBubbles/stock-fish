import type { Body } from './sprites';

/**
 * Sector → fish body (CLAUDE.md, mapping rules). Accepts GICS names and the
 * Morningstar-style names Twelve Data returns ("Technology", "Consumer
 * Cyclical", "Healthcare", ...), plus Fund (ETFs and mutual funds: the
 * sunfish) and Crypto (the anglerfish). Unknown sectors get body 3.
 */
const SECTOR_BODIES: Record<string, Body> = {
  // 1: tech triangle
  'information technology': 1,
  technology: 1,
  'communication services': 1,
  // 2: finance boxfish
  financials: 2,
  'financial services': 2,
  'real estate': 2,
  // 3: consumer pufferfish
  'consumer discretionary': 3,
  'consumer cyclical': 3,
  'consumer staples': 3,
  'consumer defensive': 3,
  // 4: energy diamond
  energy: 4,
  utilities: 4,
  // 5: industrial sawfish
  industrials: 5,
  materials: 5,
  'basic materials': 5,
  // 6: health capsule
  'health care': 6,
  healthcare: 6,
  // 7: fund sunfish
  fund: 7,
  // 8: crypto anglerfish
  crypto: 8,
};

export const DEFAULT_BODY: Body = 3;

export function bodyForSector(sector: string | undefined): Body {
  if (!sector) return DEFAULT_BODY;
  return SECTOR_BODIES[sector.trim().toLowerCase()] ?? DEFAULT_BODY;
}

/**
 * The families a user can pick for a fish, one per body. `sector` is the
 * sector stored for the choice (GICS, or Fund / Crypto), so it maps back to
 * the same body.
 */
export const FAMILIES: readonly { body: Body; label: string; sector: string }[] = [
  { body: 1, label: 'Tech & communication', sector: 'Information Technology' },
  { body: 2, label: 'Finance & real estate', sector: 'Financials' },
  { body: 3, label: 'Consumer', sector: 'Consumer Discretionary' },
  { body: 4, label: 'Energy & utilities', sector: 'Energy' },
  { body: 5, label: 'Industrial & materials', sector: 'Industrials' },
  { body: 6, label: 'Health care', sector: 'Health Care' },
  { body: 7, label: 'Fund', sector: 'Fund' },
  { body: 8, label: 'Crypto', sector: 'Crypto' },
];

/** Human name for a stored sector: its family, or Unknown. */
export function familyLabel(sector: string | undefined): string {
  if (!sector) return 'Unknown';
  const body = SECTOR_BODIES[sector.trim().toLowerCase()];
  return FAMILIES.find((f) => f.body === body)?.label ?? 'Unknown';
}
