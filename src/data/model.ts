import type { DailyBar, ProviderErrorKind, Quote } from './providers/types';

/** Hex colour without '#', one of the 32 palette colours. */
export type Hex = string;

export interface Pen {
  id: string;
  name: string;
  createdAt: number;
  /**
   * The user's territory order in this pen: holding ids, first patch first.
   * Holdings missing from it follow in the order they were added.
   */
  layout?: string[];
}

/**
 * How an overview of several pens groups the fish (docs/SPEC.md, "Organizing
 * fish"): into labelled areas, or none (every fish its own patch), or free
 * roam (no patches at all). `correlation`: holdings whose prices move together
 * (src/mood/correlation.ts).
 */
export type GroupMode = 'none' | 'pen' | 'family' | 'mood' | 'species' | 'correlation' | 'free';

export const GROUP_MODES: readonly GroupMode[] = [
  'mood',
  'pen',
  'family',
  'species',
  'correlation',
  'none',
  'free',
];

/**
 * The order of patches (and of groups): biggest first, best day first, most
 * unusual day up first, by name, or the user's own (dragged) order.
 */
export type SortMode = 'weight' | 'change' | 'mood' | 'name' | 'custom';

export const SORT_MODES: readonly SortMode[] = ['weight', 'change', 'mood', 'name', 'custom'];

/** What the tank screen shows: which pens, how an overview groups them, and the order. */
export interface TankView {
  /** 'all', or the ids of the pens shown. One id is a single pen's home. */
  pens: 'all' | string[];
  /** How an overview groups the fish. */
  group: GroupMode;
  /** Patch order in an overview. */
  sort: SortMode;
  /** Patch order in a single pen (custom: the pen's own layout). */
  homeSort: SortMode;
  /** The pens shown before "All pens" was chosen, so unticking it goes back to them. */
  beforeAll?: string[];
}

export const DEFAULT_TANK_VIEW: TankView = {
  pens: 'all',
  group: 'mood',
  sort: 'weight',
  homeSort: 'custom',
};

/**
 * A saved view, including ones from before grouping and sorting were split
 * (`arrange`: 'weight' meant no groups, biggest first).
 */
export function normalizeTankView(saved: unknown): TankView {
  const v = (saved ?? {}) as Partial<TankView> & { arrange?: string };
  const isGroup = (x: unknown): x is GroupMode => GROUP_MODES.includes(x as GroupMode);
  const isSort = (x: unknown): x is SortMode => SORT_MODES.includes(x as SortMode);
  // 'weight' meant no groups; 'together' was correlation's first name.
  const legacy = v.arrange === 'weight' ? 'none' : v.arrange;
  const group = (v.group as string) === 'together' ? 'correlation' : v.group;
  return {
    pens: v.pens === 'all' || Array.isArray(v.pens) ? v.pens : DEFAULT_TANK_VIEW.pens,
    group: isGroup(group) ? group : isGroup(legacy) ? legacy : DEFAULT_TANK_VIEW.group,
    sort: isSort(v.sort) ? v.sort : DEFAULT_TANK_VIEW.sort,
    homeSort: isSort(v.homeSort) ? v.homeSort : DEFAULT_TANK_VIEW.homeSort,
    ...(Array.isArray(v.beforeAll) &&
      v.beforeAll.every((id) => typeof id === 'string') && { beforeAll: v.beforeAll }),
  };
}

/** What's drawn with each fish in the tank, besides the fish itself. */
export interface TankLabels {
  /** The ticker under the fish. */
  ticker: boolean;
  /** Today's % change under the fish. */
  change: boolean;
  /** A small face above the fish, repeating its mood. */
  mood: boolean;
}

export const DEFAULT_TANK_LABELS: TankLabels = { ticker: false, change: false, mood: false };

export const MAX_PEN_NAME = 24;

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

/** Cached market data for one symbol. Rebuilt from the provider; never backed up. */
export interface MarketEntry {
  symbol: string;
  /** Provider the data came from; entries from another provider are ignored and refetched. */
  provider: string;
  quote?: Quote;
  /** When `quote` was fetched (ms). */
  quoteAt?: number;
  /** Daily closes, oldest first. */
  bars?: DailyBar[];
  /** When `bars` were fetched (ms). */
  barsAt?: number;
  /** Last failure for this symbol, cleared by the next success. */
  error?: { kind: ProviderErrorKind; message: string; at: number };
}

/** Cached exchange rate for one pair, e.g. USD/CAD. Rebuilt from the provider; never backed up. */
export interface FxEntry {
  /** 'FROM/TO', e.g. 'USD/CAD'. */
  pair: string;
  provider: string;
  /** Units of TO per unit of FROM. */
  rate?: number;
  /** When `rate` was fetched (ms). */
  at?: number;
  error?: { kind: ProviderErrorKind; message: string; at: number };
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
  /** Last tank view, restored on the next visit. */
  tankView?: TankView;
  /** Labels drawn with the fish in the tank. */
  tankLabels?: TankLabels;
  /** Currency totals are shown in (ISO 4217). Unset: automatic, the one most value is in. */
  homeCurrency?: string;
  /** Colour of rising prices: green (default) or red, as in China, Japan, Korea and Taiwan. */
  upColour?: UpColour;
  /** How fast fish swim to their new places when the grouping or order changes. */
  regroupSpeed?: RegroupSpeed;
}

export type RegroupSpeed = 'slow' | 'normal' | 'fast' | 'instant';
export const REGROUP_SPEEDS: readonly RegroupSpeed[] = ['slow', 'normal', 'fast', 'instant'];

export type UpColour = 'green' | 'red';

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

/** Quantities after splitting, without float dust (10 − 3.3 = 6.699999…). */
export function tidyQuantity(quantity: number): number {
  return Math.round(quantity * 1e8) / 1e8;
}

/**
 * A random v4 UUID. crypto.randomUUID only exists in secure contexts (HTTPS or
 * localhost), so a phone testing the dev server over http://192.168.… lacks
 * it; getRandomValues works everywhere.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40; // version 4
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80; // RFC 4122 variant
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
