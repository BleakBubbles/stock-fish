import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { exportBackup, restoreBackup, validateBackup } from './backup';
import { StockFishDb } from './db';
import { createRepo } from './repo';

let db: StockFishDb;

beforeEach(() => {
  db = new StockFishDb(`test-${crypto.randomUUID()}`);
});

const makeRepo = () => createRepo(db);

async function seed() {
  const repo = makeRepo();
  const pen = await repo.findOrCreatePen('TFSA');
  await repo.addHolding({ symbol: 'AAPL', quantity: 2, costBasis: 150, penId: pen.id });
  await repo.addHolding({
    symbol: 'VTI',
    quantity: 1,
    penId: pen.id,
    primary: 'f77622',
    secondary: '124e89',
  });
  const [, vti] = await db.holdings.orderBy('symbol').toArray();
  await repo.updateHolding(vti!.id, { name: 'Finn', notes: 'The boring one.' });
  await repo.feed([vti!.id], '2026-11-24');
  await repo.saveSettings({ apiKeys: { twelvedata: 'SECRET' } });
  await repo.setUserSector('ZZZZ', 'Energy');
  await repo.saveProfile({ symbol: 'AAPL', name: 'Apple', fetchedAt: 1 });
}

describe('backup', () => {
  it('round-trips through JSON and leaves out the API key', async () => {
    await seed();
    const json = JSON.stringify(await exportBackup(db));
    expect(json).not.toContain('SECRET');

    const result = validateBackup(JSON.parse(json));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const other = new StockFishDb(`test-${crypto.randomUUID()}`);
    await restoreBackup(other, result.backup);
    expect(await other.holdings.orderBy('symbol').toArray()).toEqual(
      await db.holdings.orderBy('symbol').toArray(),
    );
    expect(await other.pens.toArray()).toEqual(await db.pens.toArray());
    expect(await other.holdings.where('symbol').equals('VTI').first()).toMatchObject({
      name: 'Finn',
      notes: 'The boring one.',
      bond: { days: 1, lastVisit: '2026-11-24' },
    });
    expect(result.backup.families).toEqual({ ZZZZ: 'Energy' });
    expect((await other.profiles.get('ZZZZ'))?.userSector).toBe('Energy');
    // Cached provider data stays out of backups.
    expect(json).not.toContain('Apple');
  });

  it('restore replaces family choices but keeps cached provider data', async () => {
    await seed();
    await makeRepo().setUserSector('AAPL', 'Energy');
    const backup = await exportBackup(db);
    backup.families = { MSFT: 'Financials' };
    await restoreBackup(db, backup);
    expect((await db.profiles.get('AAPL'))?.userSector).toBeUndefined();
    expect((await db.profiles.get('AAPL'))?.name).toBe('Apple');
    expect((await db.profiles.get('ZZZZ'))?.userSector).toBeUndefined();
    expect((await db.profiles.get('MSFT'))?.userSector).toBe('Financials');
  });

  it('accepts backups without families and rejects malformed ones', () => {
    const base = { app: 'stock-fish', version: 1, pens: [], holdings: [] };
    expect(validateBackup(base).ok).toBe(true);
    expect(validateBackup({ ...base, families: { 'BAD SYM': 'Energy' } }).ok).toBe(false);
    expect(validateBackup({ ...base, families: { X: 5 } }).ok).toBe(false);
  });

  it('restore replaces existing data', async () => {
    await seed();
    const backup = await exportBackup(db);
    backup.holdings = backup.holdings.filter((h) => h.symbol === 'VTI');
    await restoreBackup(db, backup);
    expect((await db.holdings.toArray()).map((h) => h.symbol)).toEqual(['VTI']);
  });

  it('rejects other files', () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup({ app: 'other' }).ok).toBe(false);
    expect(validateBackup({ app: 'stock-fish', version: 2, pens: [], holdings: [] })).toEqual({
      ok: false,
      errors: ['Unsupported backup version: 2.'],
    });
  });

  it('reports bad holdings and dangling pens', () => {
    const result = validateBackup({
      app: 'stock-fish',
      version: 1,
      pens: [{ id: 'p', name: 'A', createdAt: 1 }],
      holdings: [
        { id: 'a', symbol: 'AAPL', quantity: -1, penId: 'p', createdAt: 1 },
        { id: 'b', symbol: 'MSFT', quantity: 1, penId: 'missing', createdAt: 1 },
        { id: 'c', symbol: 'KO', quantity: 1, penId: 'p', createdAt: 1, primary: 'red' },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(3);
  });

  it('drops unknown fields', () => {
    const result = validateBackup({
      app: 'stock-fish',
      version: 1,
      pens: [{ id: 'p', name: 'A', createdAt: 1, evil: true }],
      holdings: [{ id: 'a', symbol: 'AAPL', quantity: 1, penId: 'p', createdAt: 1, x: 1 }],
    });
    expect(result.ok && result.backup.holdings[0]).toEqual({
      id: 'a',
      symbol: 'AAPL',
      quantity: 1,
      penId: 'p',
      createdAt: 1,
    });
  });
});
