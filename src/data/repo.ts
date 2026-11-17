import type { StockFishDb } from './db';
import {
  DEFAULT_PEN_NAME,
  DEFAULT_SETTINGS,
  type Holding,
  type Pen,
  type ProviderId,
  type Settings,
  type SymbolProfile,
  isValidCostBasis,
  isValidQuantity,
  isValidSymbol,
  newId,
  normalizeSymbol,
} from './model';

export interface NewHolding {
  symbol: string;
  quantity: number;
  costBasis?: number;
  penId: string;
  primary?: string;
  secondary?: string;
}

function checkHolding(h: Pick<Holding, 'symbol' | 'quantity' | 'costBasis'>): void {
  if (!isValidSymbol(h.symbol)) throw new Error(`Invalid symbol: ${h.symbol}`);
  if (!isValidQuantity(h.quantity)) throw new Error(`Invalid quantity: ${h.quantity}`);
  if (!isValidCostBasis(h.costBasis)) throw new Error(`Invalid cost basis: ${h.costBasis}`);
}

/** Storage operations. Every write validates, so bad data never reaches IndexedDB. */
export function createRepo(db: StockFishDb) {
  async function ensureDefaultPen(): Promise<Pen> {
    return db.transaction('rw', db.pens, async () => {
      const all = await db.pens.toArray();
      const first = all.sort((a, b) => a.createdAt - b.createdAt)[0];
      if (first) return first;
      const pen: Pen = { id: newId(), name: DEFAULT_PEN_NAME, createdAt: Date.now() };
      await db.pens.add(pen);
      return pen;
    });
  }

  async function findOrCreatePen(name: string): Promise<Pen> {
    const trimmed = name.trim();
    if (!trimmed) return ensureDefaultPen();
    return db.transaction('rw', db.pens, async () => {
      const all = await db.pens.toArray();
      const match = all.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
      if (match) return match;
      const pen: Pen = { id: newId(), name: trimmed, createdAt: Date.now() };
      await db.pens.add(pen);
      return pen;
    });
  }

  async function addHolding(input: NewHolding): Promise<Holding> {
    const holding: Holding = {
      ...input,
      id: newId(),
      symbol: normalizeSymbol(input.symbol),
      createdAt: Date.now(),
    };
    checkHolding(holding);
    await db.holdings.add(holding);
    return holding;
  }

  async function updateHolding(id: string, changes: Partial<Omit<Holding, 'id'>>): Promise<void> {
    const current = await db.holdings.get(id);
    if (!current) throw new Error(`No holding ${id}`);
    const next: Holding = { ...current, ...changes, id };
    next.symbol = normalizeSymbol(next.symbol);
    checkHolding(next);
    await db.holdings.put(next);
  }

  /**
   * Upsert by symbol + pen: replaces the quantity of an existing holding (so
   * re-importing the same CSV is harmless), otherwise adds a new one.
   */
  async function upsertHolding(
    symbol: string,
    quantity: number,
    penId: string,
  ): Promise<'added' | 'updated'> {
    const s = normalizeSymbol(symbol);
    const existing = await db.holdings.where({ symbol: s, penId }).first();
    if (existing) {
      await updateHolding(existing.id, { quantity });
      return 'updated';
    }
    await addHolding({ symbol: s, quantity, penId });
    return 'added';
  }

  async function deleteHolding(id: string): Promise<void> {
    await db.holdings.delete(id);
  }

  async function getSettings(): Promise<Settings> {
    const row = await db.settings.get('settings');
    return { ...DEFAULT_SETTINGS, ...(row?.value as Partial<Settings> | undefined) };
  }

  async function saveSettings(changes: Partial<Settings>): Promise<Settings> {
    const current = await getSettings();
    const next: Settings = { ...current, ...changes };
    // A new key may be on a different plan: let it try profiles again.
    const newKeys = changes.apiKeys;
    if (newKeys && current.profileUnavailable) {
      next.profileUnavailable = Object.fromEntries(
        Object.entries(current.profileUnavailable).filter(
          ([id]) => newKeys[id as ProviderId] === current.apiKeys[id as ProviderId],
        ),
      );
    }
    await db.settings.put({ key: 'settings', value: next });
    return next;
  }

  async function getProfile(symbol: string): Promise<SymbolProfile | undefined> {
    return db.profiles.get(normalizeSymbol(symbol));
  }

  /** Merge into the stored profile, keeping fields the update doesn't mention. */
  async function saveProfile(profile: SymbolProfile): Promise<void> {
    const symbol = normalizeSymbol(profile.symbol);
    await db.transaction('rw', db.profiles, async () => {
      const current = await db.profiles.get(symbol);
      await db.profiles.put({ ...current, ...profile, symbol });
    });
  }

  /** The user's family choice for a symbol; undefined clears it. */
  async function setUserSector(symbol: string, sector: string | undefined): Promise<void> {
    await saveProfile({ symbol, userSector: sector });
  }

  return {
    ensureDefaultPen,
    findOrCreatePen,
    addHolding,
    updateHolding,
    upsertHolding,
    deleteHolding,
    getSettings,
    saveSettings,
    getProfile,
    saveProfile,
    setUserSector,
  };
}

export type Repo = ReturnType<typeof createRepo>;
