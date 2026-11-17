import { describe, expect, it } from 'vitest';
import { CSV_TEMPLATE, parseHoldingsCsv, splitCsvLine } from './csv';

describe('splitCsvLine', () => {
  it('handles quotes, escaped quotes and padding', () => {
    expect(splitCsvLine(' a , "b, c" ,"say ""hi"""')).toEqual(['a', 'b, c', 'say "hi"']);
    expect(splitCsvLine('a,,')).toEqual(['a', '', '']);
  });
});

describe('parseHoldingsCsv', () => {
  it('parses the template', () => {
    expect(parseHoldingsCsv(CSV_TEMPLATE)).toEqual({
      rows: [
        { line: 2, symbol: 'AAPL', quantity: 10, pen: 'My tank' },
        { line: 3, symbol: 'VTI', quantity: 25.5, pen: 'TFSA' },
      ],
      errors: [],
    });
  });

  it('accepts any column order, case, CRLF, BOM, blank lines and extra columns', () => {
    const text =
      String.fromCharCode(0xfeff) + 'Pen,Notes,QUANTITY,Symbol\r\n\r\n"RRSP, joint",x,3,brk.b\r\n';
    expect(parseHoldingsCsv(text).rows).toEqual([
      { line: 3, symbol: 'BRK.B', quantity: 3, pen: 'RRSP, joint' },
    ]);
  });

  it('pen column is optional', () => {
    expect(parseHoldingsCsv('symbol,quantity\nmsft,1').rows[0]).toMatchObject({ pen: '' });
  });

  it('reports bad rows with line numbers and keeps the good ones', () => {
    const result = parseHoldingsCsv('symbol,quantity\nAAPL,abc\n,5\nMSFT,-1\nKO,2\nX Y,1');
    expect(result.rows.map((r) => r.symbol)).toEqual(['KO']);
    expect(result.errors.map((e) => e.line)).toEqual([2, 3, 4, 6]);
  });

  it('rejects a missing header and an empty file', () => {
    expect(parseHoldingsCsv('AAPL,10').errors[0]?.message).toMatch(/header/);
    expect(parseHoldingsCsv('  \n').errors[0]?.message).toMatch(/empty/);
    expect(parseHoldingsCsv('symbol,quantity\n').errors[0]?.message).toMatch(/No holdings/);
  });
});
