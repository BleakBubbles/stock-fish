import { isValidQuantity, isValidSymbol, normalizeSymbol } from './model';

/** The CSV template users download and fill in. */
export const CSV_TEMPLATE = 'symbol,quantity,pen\nAAPL,10,My tank\nVTI,25.5,TFSA\n';

export interface CsvRow {
  /** 1-based line number in the file, for messages. */
  line: number;
  symbol: string;
  quantity: number;
  /** Pen name; empty means the default pen. */
  pen: string;
}

export interface CsvError {
  line: number;
  message: string;
}

export interface CsvResult {
  rows: CsvRow[];
  errors: CsvError[];
}

/** Split one CSV line, honouring double quotes ("a, b" and "" escapes). */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      fields.push(field);
      field = '';
    } else {
      field += c;
    }
  }
  fields.push(field);
  return fields.map((f) => f.trim());
}

/**
 * Parse the holdings template: a header naming `symbol` and `quantity` (any
 * order, any case), optional `pen`, extra columns ignored. Blank lines are
 * skipped. Bad rows are reported, not fatal.
 */
export function parseHoldingsCsv(text: string): CsvResult {
  // Drop a byte-order mark (Excel adds one to UTF-8 CSVs).
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = body.split(/\r?\n/);
  const rows: CsvRow[] = [];
  const errors: CsvError[] = [];

  const headerIndex = lines.findIndex((l) => l.trim() !== '');
  if (headerIndex === -1) return { rows, errors: [{ line: 1, message: 'The file is empty.' }] };

  const header = splitCsvLine(lines[headerIndex] ?? '').map((h) => h.toLowerCase());
  const col = {
    symbol: header.indexOf('symbol'),
    quantity: header.indexOf('quantity'),
    pen: header.indexOf('pen'),
  };
  if (col.symbol === -1 || col.quantity === -1) {
    return {
      rows,
      errors: [
        {
          line: headerIndex + 1,
          message: 'The first line must be a header with "symbol" and "quantity" columns.',
        },
      ],
    };
  }

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    if (raw.trim() === '') continue;
    const line = i + 1;
    const fields = splitCsvLine(raw);
    const symbol = normalizeSymbol(fields[col.symbol] ?? '');
    const quantityText = (fields[col.quantity] ?? '').replace(/_/g, '');
    const quantity = quantityText === '' ? NaN : Number(quantityText);
    const pen = col.pen === -1 ? '' : (fields[col.pen] ?? '');

    if (!isValidSymbol(symbol)) {
      errors.push({ line, message: `"${fields[col.symbol] ?? ''}" is not a valid symbol.` });
    } else if (!isValidQuantity(quantity)) {
      errors.push({ line, message: `"${fields[col.quantity] ?? ''}" is not a positive number.` });
    } else {
      rows.push({ line, symbol, quantity, pen });
    }
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ line: headerIndex + 1, message: 'No holdings found under the header.' });
  }
  return { rows, errors };
}
