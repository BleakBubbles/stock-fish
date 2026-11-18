import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { StockFishDb } from './db';
import { SAMPLE_TANK_CSV, importHoldingsCsv } from './importCsv';
import { type Repo, createRepo } from './repo';
import { resolveSector } from './sectors';

let db: StockFishDb;
let repo: Repo;

beforeEach(() => {
  db = new StockFishDb(`test-${crypto.randomUUID()}`);
  repo = createRepo(db);
});

describe('importHoldingsCsv', () => {
  it('creates pens by name and reports what changed', async () => {
    const report = await importHoldingsCsv(repo, 'symbol,quantity,pen\nAAPL,3,TFSA\nnope!,1,\n');
    expect(report).toMatchObject({ added: 1, updated: 0 });
    expect(report.errors).toHaveLength(1);
    expect((await db.pens.toArray()).map((p) => p.name)).toEqual(['TFSA']);
  });
});

describe('sample tank', () => {
  it('loads cleanly into three pens, and loading it again changes nothing', async () => {
    const first = await importHoldingsCsv(repo, SAMPLE_TANK_CSV);
    expect(first).toEqual({ added: 11, updated: 0, errors: [] });
    expect(await db.pens.count()).toBe(3);
    const again = await importHoldingsCsv(repo, SAMPLE_TANK_CSV);
    expect(again).toMatchObject({ added: 0, updated: 11 });
    expect(await db.holdings.count()).toBe(11);
  });

  it('uses only symbols the built-in sector table knows', () => {
    const symbols = SAMPLE_TANK_CSV.trim()
      .split('\n')
      .slice(1)
      .map((l) => l.split(',')[0] ?? '');
    for (const s of symbols) expect(resolveSector(s, undefined).sector, s).toBeDefined();
  });
});
