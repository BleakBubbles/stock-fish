import type { StockFishDb } from './db';
import {
  DEFAULT_PEN_NAME,
  DEFAULT_SETTINGS,
  type Holding,
  MAX_PEN_NAME,
  type Pen,
  type ProviderId,
  type Settings,
  type SymbolProfile,
  isValidCostBasis,
  isValidQuantity,
  isValidSymbol,
  newId,
  normalizeSymbol,
  tidyQuantity,
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

/**
 * Average cost after merging `amount` shares of `from` into `into`. Only known
 * when both sides have one: a guessed cost basis is worse than none.
 */
function mergedCostBasis(into: Holding, from: Holding, amount: number): number | undefined {
  if (into.costBasis === undefined || from.costBasis === undefined) return undefined;
  return (into.costBasis * into.quantity + from.costBasis * amount) / (into.quantity + amount);
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

  /** A trimmed, unused pen name; throws a message for the user otherwise. */
  async function checkPenName(name: string, exceptId?: string): Promise<string> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Give the pen a name.');
    if (trimmed.length > MAX_PEN_NAME) {
      throw new Error(`Pen names can be up to ${MAX_PEN_NAME} characters.`);
    }
    const all = await db.pens.toArray();
    const clash = all.find(
      (p) => p.id !== exceptId && p.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (clash) throw new Error(`There's already a pen called ${clash.name}.`);
    return trimmed;
  }

  async function createPen(name: string): Promise<Pen> {
    return db.transaction('rw', db.pens, async () => {
      const pen: Pen = { id: newId(), name: await checkPenName(name), createdAt: Date.now() };
      await db.pens.add(pen);
      return pen;
    });
  }

  async function renamePen(id: string, name: string): Promise<void> {
    await db.transaction('rw', db.pens, async () => {
      const trimmed = await checkPenName(name, id);
      const n = await db.pens.update(id, { name: trimmed });
      if (!n) throw new Error(`No pen ${id}`);
    });
  }

  async function setPenLayout(id: string, layout: string[]): Promise<void> {
    await db.pens.update(id, { layout });
  }

  /**
   * Move `quantity` of a holding (all of it if omitted) to another pen. If that
   * pen already has this symbol, the two merge into one fish; otherwise a part
   * move creates a new fish with the same colours. Returns the id of the fish
   * in the target pen.
   */
  async function moveHolding(id: string, penId: string, quantity?: number): Promise<string> {
    return db.transaction('rw', db.holdings, db.pens, async () => {
      const source = await db.holdings.get(id);
      if (!source) throw new Error(`No holding ${id}`);
      if (!(await db.pens.get(penId))) throw new Error(`No pen ${penId}`);
      if (source.penId === penId) return id;
      const amount = quantity === undefined ? source.quantity : tidyQuantity(quantity);
      if (!isValidQuantity(amount) || amount > source.quantity) {
        throw new Error(`Can't move ${quantity} of ${source.quantity}.`);
      }
      const whole = amount === source.quantity;
      const target = await db.holdings.where({ symbol: source.symbol, penId }).first();

      if (whole) {
        await db.holdings.delete(id);
        const pen = await db.pens.get(source.penId);
        if (pen?.layout) {
          await db.pens.update(pen.id, { layout: pen.layout.filter((x) => x !== id) });
        }
      } else {
        await db.holdings.update(id, { quantity: tidyQuantity(source.quantity - amount) });
      }

      if (target) {
        await db.holdings.put({
          ...target,
          quantity: tidyQuantity(target.quantity + amount),
          costBasis: mergedCostBasis(target, source, amount),
        });
        return target.id;
      }
      // A whole move keeps the fish (and its id); a part move adds a sibling.
      const moved: Holding = whole
        ? { ...source, penId }
        : { ...source, id: newId(), penId, quantity: amount, createdAt: Date.now() };
      await db.holdings.put(moved);
      return moved.id;
    });
  }

  /** Delete a pen, moving its fish into `intoPenId`. The last pen can't go. */
  async function deletePen(id: string, intoPenId: string): Promise<void> {
    if (id === intoPenId) throw new Error('Pick another pen for its sharks.');
    await db.transaction('rw', db.holdings, db.pens, async () => {
      if ((await db.pens.count()) <= 1) throw new Error("The last pen can't be deleted.");
      for (const h of await db.holdings.where({ penId: id }).toArray()) {
        await moveHolding(h.id, intoPenId);
      }
      await db.pens.delete(id);
    });
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
    createPen,
    renamePen,
    setPenLayout,
    moveHolding,
    deletePen,
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
