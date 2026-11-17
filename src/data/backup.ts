import type { StockFishDb } from './db';
import { type Holding, type Pen, isValidCostBasis, isValidQuantity, isValidSymbol } from './model';

/**
 * JSON backup of the tank: pens, holdings and the families the user picked.
 * API keys and cached provider data are deliberately left out, so a backup is
 * safe to share or store.
 */
export interface Backup {
  app: 'stock-fish';
  version: 1;
  exportedAt: string;
  pens: Pen[];
  holdings: Holding[];
  /** Symbol → sector the user chose. Optional: older backups don't have it. */
  families?: Record<string, string>;
}

export async function exportBackup(db: StockFishDb, now = new Date()): Promise<Backup> {
  const [pens, holdings, profiles] = await Promise.all([
    db.pens.toArray(),
    db.holdings.toArray(),
    db.profiles.toArray(),
  ]);
  const families = Object.fromEntries(
    profiles.filter((p) => p.userSector).map((p) => [p.symbol, p.userSector as string]),
  );
  return {
    app: 'stock-fish',
    version: 1,
    exportedAt: now.toISOString(),
    pens,
    holdings,
    families,
  };
}

const HEX = /^[0-9a-f]{6}$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function optional<T>(v: unknown, check: (x: unknown) => x is T): v is T | undefined {
  return v === undefined || check(v);
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);

/**
 * Check an untrusted parsed JSON value is a valid backup. Returns the cleaned
 * backup (unknown fields dropped) or a list of problems.
 */
export function validateBackup(
  data: unknown,
): { ok: true; backup: Backup } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!isObject(data) || data.app !== 'stock-fish') {
    return { ok: false, errors: ['This is not a Stock Fish backup file.'] };
  }
  if (data.version !== 1) {
    return { ok: false, errors: [`Unsupported backup version: ${String(data.version)}.`] };
  }
  if (!Array.isArray(data.pens) || !Array.isArray(data.holdings)) {
    return { ok: false, errors: ['The backup is missing its pens or holdings.'] };
  }

  const pens: Pen[] = [];
  data.pens.forEach((p: unknown, i) => {
    if (isObject(p) && isString(p.id) && p.id && isString(p.name) && isNumber(p.createdAt)) {
      pens.push({ id: p.id, name: p.name, createdAt: p.createdAt });
    } else {
      errors.push(`Pen ${i + 1} is malformed.`);
    }
  });
  const penIds = new Set(pens.map((p) => p.id));
  if (penIds.size !== pens.length) errors.push('Two pens share an id.');

  const holdings: Holding[] = [];
  data.holdings.forEach((h: unknown, i) => {
    const label = `Holding ${i + 1}`;
    if (
      !isObject(h) ||
      !isString(h.id) ||
      !h.id ||
      !isString(h.symbol) ||
      !isNumber(h.quantity) ||
      !isString(h.penId) ||
      !isNumber(h.createdAt) ||
      !optional(h.costBasis, isNumber) ||
      !optional(h.primary, isHex) ||
      !optional(h.secondary, isHex)
    ) {
      errors.push(`${label} is malformed.`);
      return;
    }
    if (!isValidSymbol(h.symbol)) errors.push(`${label}: invalid symbol ${h.symbol}.`);
    else if (!isValidQuantity(h.quantity)) errors.push(`${label}: invalid quantity.`);
    else if (!isValidCostBasis(h.costBasis)) errors.push(`${label}: invalid cost basis.`);
    else if (!penIds.has(h.penId)) errors.push(`${label} (${h.symbol}) belongs to a missing pen.`);
    else {
      const clean: Holding = {
        id: h.id,
        symbol: h.symbol,
        quantity: h.quantity,
        penId: h.penId,
        createdAt: h.createdAt,
      };
      if (h.costBasis !== undefined) clean.costBasis = h.costBasis;
      if (h.primary !== undefined) clean.primary = h.primary;
      if (h.secondary !== undefined) clean.secondary = h.secondary;
      holdings.push(clean);
    }
  });
  if (new Set(holdings.map((h) => h.id)).size !== holdings.length) {
    errors.push('Two holdings share an id.');
  }

  const families: Record<string, string> = {};
  if (data.families !== undefined) {
    if (!isObject(data.families)) errors.push('The families list is malformed.');
    else {
      for (const [symbol, sector] of Object.entries(data.families)) {
        if (isValidSymbol(symbol) && isString(sector) && sector && sector.length <= 40) {
          families[symbol] = sector;
        } else {
          errors.push(`The family for ${symbol} is malformed.`);
        }
      }
    }
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    backup: {
      app: 'stock-fish',
      version: 1,
      exportedAt: isString(data.exportedAt) ? data.exportedAt : '',
      pens,
      holdings,
      families,
    },
  };
}

/**
 * Replace all pens, holdings and family choices with the backup's, atomically.
 * Settings and cached provider data are kept.
 */
export async function restoreBackup(db: StockFishDb, backup: Backup): Promise<void> {
  await db.transaction('rw', db.pens, db.holdings, db.profiles, async () => {
    await db.holdings.clear();
    await db.pens.clear();
    await db.pens.bulkAdd(backup.pens);
    await db.holdings.bulkAdd(backup.holdings);

    const profiles = await db.profiles.toArray();
    await db.profiles.bulkPut(profiles.map((p) => ({ ...p, userSector: undefined })));
    for (const [symbol, sector] of Object.entries(backup.families ?? {})) {
      const current = await db.profiles.get(symbol);
      await db.profiles.put({ ...current, symbol, userSector: sector });
    }
  });
}
