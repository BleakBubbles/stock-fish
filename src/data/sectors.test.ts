import { describe, expect, it } from 'vitest';
import table from './sectors.json';
import { builtinSector, resolveSector } from './sectors';

describe('built-in sector table', () => {
  it('knows common tickers', () => {
    expect(builtinSector('intc')).toBe('Information Technology');
    expect(builtinSector('GOOG')).toBe('Communication Services');
    expect(builtinSector('MCD')).toBe('Consumer Discretionary');
    expect(builtinSector('BRK.B')).toBe('Financials');
    expect(builtinSector('VTI')).toBe('Fund');
    expect(builtinSector('NOPE')).toBeUndefined();
  });

  it('calls any crypto pair Crypto, but not currency pairs', () => {
    expect(builtinSector('DOGE/USD')).toBe('Crypto');
    expect(builtinSector('sol/eur')).toBe('Crypto');
    expect(builtinSector('EUR/USD')).toBeUndefined();
  });

  it('uses only the 11 GICS sectors, Fund and Crypto', () => {
    const allowed = new Set([
      'Communication Services',
      'Consumer Discretionary',
      'Consumer Staples',
      'Energy',
      'Financials',
      'Health Care',
      'Industrials',
      'Information Technology',
      'Materials',
      'Real Estate',
      'Utilities',
      'Fund',
      'Crypto',
    ]);
    for (const [symbol, sector] of Object.entries(table.sectors)) {
      expect(allowed.has(sector), `${symbol}: ${sector}`).toBe(true);
    }
  });
});

describe('resolveSector', () => {
  it('ranks user, then provider, then the table', () => {
    expect(resolveSector('INTC')).toEqual({ sector: 'Information Technology', source: 'builtin' });
    expect(resolveSector('INTC', { symbol: 'INTC', sector: 'Technology' })).toEqual({
      sector: 'Technology',
      source: 'provider',
    });
    expect(
      resolveSector('INTC', { symbol: 'INTC', sector: 'Technology', userSector: 'Energy' }),
    ).toEqual({ sector: 'Energy', source: 'user' });
    expect(resolveSector('ZZZZ')).toEqual({});
  });
});
