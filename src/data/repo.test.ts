import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { StockFishDb } from './db';
import { createRepo, type Repo } from './repo';

let db: StockFishDb;
let repo: Repo;

beforeEach(() => {
  db = new StockFishDb(`test-${crypto.randomUUID()}`);
  repo = createRepo(db);
});

describe('pens', () => {
  it('creates one default pen and reuses it', async () => {
    const a = await repo.ensureDefaultPen();
    const b = await repo.ensureDefaultPen();
    expect(a.id).toBe(b.id);
    expect(await db.pens.count()).toBe(1);
  });

  it('finds pens by name case-insensitively', async () => {
    const a = await repo.findOrCreatePen('TFSA');
    const b = await repo.findOrCreatePen(' tfsa ');
    expect(b.id).toBe(a.id);
  });

  it('blank pen name means the default pen', async () => {
    const def = await repo.ensureDefaultPen();
    expect((await repo.findOrCreatePen('  ')).id).toBe(def.id);
  });
});

describe('holdings', () => {
  it('normalises the symbol and stores optional fields', async () => {
    const pen = await repo.ensureDefaultPen();
    const h = await repo.addHolding({
      symbol: ' aapl ',
      quantity: 3,
      penId: pen.id,
      primary: 'f77622',
    });
    expect(h.symbol).toBe('AAPL');
    expect(await db.holdings.get(h.id)).toMatchObject({
      symbol: 'AAPL',
      quantity: 3,
      primary: 'f77622',
    });
  });

  it('rejects bad input', async () => {
    const pen = await repo.ensureDefaultPen();
    await expect(
      repo.addHolding({ symbol: 'AA PL', quantity: 1, penId: pen.id }),
    ).rejects.toThrow();
    await expect(repo.addHolding({ symbol: 'AAPL', quantity: 0, penId: pen.id })).rejects.toThrow();
    await expect(
      repo.addHolding({ symbol: 'AAPL', quantity: 1, costBasis: -1, penId: pen.id }),
    ).rejects.toThrow();
    expect(await db.holdings.count()).toBe(0);
  });

  it('allows the same symbol in different pens', async () => {
    const a = await repo.findOrCreatePen('A');
    const b = await repo.findOrCreatePen('B');
    await repo.addHolding({ symbol: 'VTI', quantity: 1, penId: a.id });
    await repo.addHolding({ symbol: 'VTI', quantity: 2, penId: b.id });
    expect(await db.holdings.where('symbol').equals('VTI').count()).toBe(2);
  });

  it('upsert replaces quantity within a pen and keeps colours', async () => {
    const pen = await repo.ensureDefaultPen();
    expect(await repo.upsertHolding('msft', 5, pen.id)).toBe('added');
    const [first] = await db.holdings.toArray();
    await repo.updateHolding(first!.id, { primary: '124e89' });
    expect(await repo.upsertHolding('MSFT', 7, pen.id)).toBe('updated');
    const all = await db.holdings.toArray();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ quantity: 7, primary: '124e89' });
  });
});

describe('settings', () => {
  it('defaults and merges', async () => {
    expect((await repo.getSettings()).provider).toBe('twelvedata');
    await repo.saveSettings({ apiKeys: { twelvedata: 'k' } });
    await repo.saveSettings({ provider: 'mock' });
    expect(await repo.getSettings()).toEqual({ provider: 'mock', apiKeys: { twelvedata: 'k' } });
  });
});

describe('profiles', () => {
  it('merges updates and keeps the user sector', async () => {
    await repo.saveProfile({ symbol: 'intc', name: 'Intel' });
    await repo.setUserSector('INTC', 'Energy');
    await repo.saveProfile({ symbol: 'INTC', fetchedAt: 5 });
    expect(await repo.getProfile('INTC')).toEqual({
      symbol: 'INTC',
      name: 'Intel',
      userSector: 'Energy',
      fetchedAt: 5,
    });
  });
});

describe('pen management', () => {
  const add = (penId: string, symbol: string, quantity: number, costBasis?: number) =>
    repo.addHolding({ symbol, quantity, penId, costBasis, primary: 'e43b44' });

  it('creates and renames pens, refusing blank and duplicate names', async () => {
    const tfsa = await repo.createPen(' TFSA ');
    expect(tfsa.name).toBe('TFSA');
    await expect(repo.createPen('tfsa')).rejects.toThrow(/already/);
    await expect(repo.createPen('  ')).rejects.toThrow(/name/);
    await repo.renamePen(tfsa.id, 'RRSP');
    expect((await db.pens.get(tfsa.id))?.name).toBe('RRSP');
    await repo.renamePen(tfsa.id, 'rrsp'); // its own name in another case is fine
  });

  it('moves a whole holding, keeping its id and leaving the old layout', async () => {
    const a = await repo.ensureDefaultPen();
    const b = await repo.createPen('B');
    const h = await add(a.id, 'AAPL', 5);
    await repo.setPenLayout(a.id, [h.id]);
    expect(await repo.moveHolding(h.id, b.id)).toBe(h.id);
    expect((await db.holdings.get(h.id))?.penId).toBe(b.id);
    expect((await db.pens.get(a.id))?.layout).toEqual([]);
  });

  it('splits part of a holding into a new fish with the same colours', async () => {
    const a = await repo.ensureDefaultPen();
    const b = await repo.createPen('B');
    const h = await add(a.id, 'AAPL', 10, 100);
    const id = await repo.moveHolding(h.id, b.id, 3.3);
    expect(id).not.toBe(h.id);
    expect((await db.holdings.get(h.id))?.quantity).toBe(6.7);
    expect(await db.holdings.get(id)).toMatchObject({
      symbol: 'AAPL',
      quantity: 3.3,
      penId: b.id,
      primary: 'e43b44',
      costBasis: 100,
    });
  });

  it('merges into the same symbol in the target pen', async () => {
    const a = await repo.ensureDefaultPen();
    const b = await repo.createPen('B');
    const h = await add(a.id, 'AAPL', 2, 100);
    const t = await add(b.id, 'AAPL', 2, 200);
    expect(await repo.moveHolding(h.id, b.id)).toBe(t.id);
    expect(await db.holdings.get(h.id)).toBeUndefined();
    expect(await db.holdings.get(t.id)).toMatchObject({ quantity: 4, costBasis: 150 });
  });

  it('refuses to move more than the holding has', async () => {
    const a = await repo.ensureDefaultPen();
    const b = await repo.createPen('B');
    const h = await add(a.id, 'AAPL', 2);
    await expect(repo.moveHolding(h.id, b.id, 3)).rejects.toThrow();
    await expect(repo.moveHolding(h.id, b.id, 0)).rejects.toThrow();
  });

  it('deleting a pen moves its fish; the last pen stays', async () => {
    const a = await repo.ensureDefaultPen();
    const b = await repo.createPen('B');
    await add(b.id, 'AAPL', 1);
    await add(b.id, 'MSFT', 1);
    await add(a.id, 'AAPL', 1);
    await repo.deletePen(b.id, a.id);
    expect(await db.pens.count()).toBe(1);
    const left = await db.holdings.toArray();
    expect(left.map((h) => [h.symbol, h.quantity, h.penId]).sort()).toEqual([
      ['AAPL', 2, a.id],
      ['MSFT', 1, a.id],
    ]);
    await expect(repo.deletePen(a.id, b.id)).rejects.toThrow();
  });
});
