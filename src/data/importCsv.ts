import { type CsvError, parseHoldingsCsv } from './csv';
import type { Repo } from './repo';

export interface ImportReport {
  added: number;
  updated: number;
  errors: CsvError[];
}

/**
 * Add holdings from `symbol,quantity,pen` CSV text. Pens named in the file are
 * created as needed; a symbol already in that pen gets its quantity replaced,
 * so importing the same file twice is harmless.
 */
export async function importHoldingsCsv(repo: Repo, text: string): Promise<ImportReport> {
  const { rows, errors } = parseHoldingsCsv(text);
  let added = 0;
  let updated = 0;
  for (const row of rows) {
    const pen = await repo.findOrCreatePen(row.pen);
    const result = await repo.upsertHolding(row.symbol, row.quantity, pen.id);
    if (result === 'added') added++;
    else updated++;
  }
  return { added, updated, errors };
}

/**
 * A made-up example tank for trying the app: a mix of sectors (so every body
 * shape appears), a fund, one ticker split across two pens, and a small
 * holding that shares the communal patch. Not a suggestion of what to own.
 * Ten symbols, so a free Twelve Data key fills it in under three minutes.
 */
export const SAMPLE_TANK_CSV = `symbol,quantity,pen
AAPL,15,Sample: Taxable
MSFT,8,Sample: Taxable
JPM,10,Sample: Taxable
XOM,12,Sample: Taxable
CAT,4,Sample: Taxable
NVDA,20,Sample: TFSA
VOO,6,Sample: TFSA
JNJ,10,Sample: TFSA
KO,40,Sample: Retirement
PG,2,Sample: Retirement
AAPL,5,Sample: Retirement
`;
