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
