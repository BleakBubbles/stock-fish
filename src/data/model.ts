/** Hex colour without '#', one of the 32 palette colours. */
export type Hex = string;

export interface Pen {
  id: string;
  name: string;
  createdAt: number;
}

/**
 * One fish: a position in one ticker, living in one pen. The same symbol can
 * have holdings in several pens (a split holding).
 */
export interface Holding {
  id: string;
  /** Upper-cased ticker as the provider knows it, e.g. AAPL, BRK.B, BTC/USD. */
  symbol: string;
  quantity: number;
  /** Optional average cost per share, in the holding's trading currency. */
  costBasis?: number;
  penId: string;
  /** Body colour override; unset means the default for the symbol. */
  primary?: Hex;
  /** Fin colour override; unset means the default for the symbol. */
  secondary?: Hex;
  createdAt: number;
}

/**
 * What the app knows about a symbol (a species). The sector picks the fish
 * body; see src/data/sectors.ts for how the sources rank.
 */
export interface SymbolProfile {
  symbol: string;
  /** Sector from the provider's company profile, if it has one. */
  sector?: string;
  /** Sector (family) the user chose; wins over every other source. */
  userSector?: string;
  name?: string;
  /** When the provider was last asked; unset if it never was. */
  fetchedAt?: number;
}

export type ProviderId = 'twelvedata' | 'mock';

export interface Settings {
  provider: ProviderId;
  /** The user's own API keys. Stored only in this browser (CLAUDE.md rule 2). */
  apiKeys: Partial<Record<ProviderId, string>>;
  /**
   * Providers whose company-profile endpoint refused this key's plan, so we
   * stop spending requests on it. Cleared when that provider's key changes.
   */
  profileUnavailable?: Partial<Record<ProviderId, true>>;
}

export const DEFAULT_SETTINGS: Settings = { provider: 'twelvedata', apiKeys: {} };

export const DEFAULT_PEN_NAME = 'My tank';

/** Letters and digits, plus . - : / ^ = (e.g. BRK.B, RY:TSX, BTC/USD, ^GSPC). */
const SYMBOL_PATTERN = /^[A-Z0-9^][A-Z0-9.\-:/^=]{0,19}$/;

export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidSymbol(symbol: string): boolean {
  return SYMBOL_PATTERN.test(symbol);
}

export function isValidQuantity(quantity: number): boolean {
  return Number.isFinite(quantity) && quantity > 0;
}

export function isValidCostBasis(costBasis: number | undefined): boolean {
  return costBasis === undefined || (Number.isFinite(costBasis) && costBasis >= 0);
}

export function newId(): string {
  return crypto.randomUUID();
}
