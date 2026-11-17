/**
 * Regenerate src/data/sectors.json, the built-in ticker → sector table.
 *
 * Source: S&P 500 constituents with GICS sectors from
 * https://github.com/datasets/s-and-p-500-companies (ODC-PDDL-1.0, public
 * domain). Download data/constituents.csv, then run:
 *
 *   node --experimental-strip-types scripts/update-sectors.ts path/to/constituents.csv
 *
 * Funds and crypto below are curated by hand. Sector ETFs map to their sector;
 * broad funds get "Fund", which draws the default body until funds get one.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FUND = 'Fund';
const CRYPTO = 'Crypto';

const HAND_PICKED: Record<string, string> = {
  // Broad US, international and bond funds
  SPY: FUND,
  VOO: FUND,
  IVV: FUND,
  SPLG: FUND,
  VTI: FUND,
  ITOT: FUND,
  SCHB: FUND,
  SCHX: FUND,
  QQQ: FUND,
  QQQM: FUND,
  DIA: FUND,
  IWM: FUND,
  IJH: FUND,
  IJR: FUND,
  RSP: FUND,
  MDY: FUND,
  VUG: FUND,
  VTV: FUND,
  VIG: FUND,
  SCHD: FUND,
  VYM: FUND,
  JEPI: FUND,
  JEPQ: FUND,
  ARKK: FUND,
  VEA: FUND,
  IEFA: FUND,
  EFA: FUND,
  VWO: FUND,
  IEMG: FUND,
  EEM: FUND,
  VXUS: FUND,
  VT: FUND,
  AGG: FUND,
  BND: FUND,
  BNDX: FUND,
  TLT: FUND,
  IEF: FUND,
  SHY: FUND,
  LQD: FUND,
  HYG: FUND,
  GLD: FUND,
  IAU: FUND,
  SLV: FUND,
  // Sector funds: same family as the sector they track
  XLK: 'Information Technology',
  VGT: 'Information Technology',
  SMH: 'Information Technology',
  SOXX: 'Information Technology',
  XLC: 'Communication Services',
  XLF: 'Financials',
  VFH: 'Financials',
  KRE: 'Financials',
  XLRE: 'Real Estate',
  VNQ: 'Real Estate',
  XLY: 'Consumer Discretionary',
  XLP: 'Consumer Staples',
  XLE: 'Energy',
  VDE: 'Energy',
  XLU: 'Utilities',
  VPU: 'Utilities',
  XLI: 'Industrials',
  ITA: 'Industrials',
  XLB: 'Materials',
  GDX: 'Materials',
  XLV: 'Health Care',
  VHT: 'Health Care',
  IBB: 'Health Care',
  XBI: 'Health Care',
  // Crypto pairs as Twelve Data names them
  'BTC/USD': CRYPTO,
  'ETH/USD': CRYPTO,
  'SOL/USD': CRYPTO,
  'BTC/CAD': CRYPTO,
  'ETH/CAD': CRYPTO,
};

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted && c === '"' && line[i + 1] === '"') {
      field += '"';
      i++;
    } else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else field += c;
  }
  fields.push(field);
  return fields.map((f) => f.trim());
}

const input = process.argv[2];
if (!input) {
  console.error('usage: update-sectors.ts path/to/constituents.csv');
  process.exit(1);
}

const [header = '', ...rows] = readFileSync(input, 'utf8').split(/\r?\n/).filter(Boolean);
const cols = splitCsvLine(header);
const symbolCol = cols.indexOf('Symbol');
const sectorCol = cols.indexOf('GICS Sector');
if (symbolCol === -1 || sectorCol === -1) throw new Error(`Unexpected header: ${header}`);

const sectors: Record<string, string> = {};
for (const row of rows) {
  const fields = splitCsvLine(row);
  const symbol = fields[symbolCol]?.toUpperCase();
  const sector = fields[sectorCol];
  if (symbol && sector) sectors[symbol] = sector;
}
const fromIndex = Object.keys(sectors).length;
Object.assign(sectors, HAND_PICKED);

const sorted = Object.fromEntries(Object.entries(sectors).sort(([a], [b]) => a.localeCompare(b)));
const out = {
  _source:
    'S&P 500 GICS sectors from github.com/datasets/s-and-p-500-companies (ODC-PDDL-1.0), ' +
    `fetched ${new Date().toISOString().slice(0, 10)}; funds and crypto curated by hand. ` +
    'Regenerate with scripts/update-sectors.ts.',
  sectors: sorted,
};
writeFileSync(
  new URL('../src/data/sectors.json', import.meta.url),
  JSON.stringify(out, null, 1) + '\n',
);
console.log(`Wrote ${Object.keys(sorted).length} symbols (${fromIndex} from the index).`);
