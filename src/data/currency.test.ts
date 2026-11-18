import { describe, expect, it } from 'vitest';
import {
  autoHomeCurrency,
  homeFactor,
  normalizeCurrency,
  pairsNeeded,
  rateBetween,
} from './currency';

const rates = new Map([
  ['USD/CAD', 1.4],
  ['GBP/USD', 1.25],
]);

describe('rateBetween', () => {
  it('uses a direct rate, its inverse, or crosses through USD', () => {
    expect(rateBetween('USD', 'CAD', rates)).toBe(1.4);
    expect(rateBetween('CAD', 'USD', rates)).toBeCloseTo(1 / 1.4);
    expect(rateBetween('GBP', 'CAD', rates)).toBeCloseTo(1.25 * 1.4);
    expect(rateBetween('CAD', 'CAD', rates)).toBe(1);
  });

  it("is undefined when the table can't say", () => {
    expect(rateBetween('JPY', 'CAD', rates)).toBeUndefined();
  });
});

describe('minor units', () => {
  it('treats pence as hundredths of a pound', () => {
    expect(normalizeCurrency('GBp')).toEqual({ code: 'GBP', factor: 0.01 });
    // 1250 pence in USD: £12.50 × 1.25
    expect(1250 * (homeFactor('GBp', 'USD', rates) ?? NaN)).toBeCloseTo(15.625);
  });
});

describe('homeFactor', () => {
  it('converts, and is undefined until the rate is known', () => {
    expect(homeFactor('USD', 'CAD', rates)).toBe(1.4);
    expect(homeFactor('JPY', 'CAD', rates)).toBeUndefined();
    expect(homeFactor(undefined, 'CAD', rates)).toBe(1);
  });
});

describe('autoHomeCurrency', () => {
  it('picks the currency holding most of the value', () => {
    expect(
      autoHomeCurrency([
        { currency: 'USD', value: 3000 },
        { currency: 'CAD', value: 2000 },
        { currency: 'CAD', value: 2000 },
      ]),
    ).toBe('CAD');
  });

  it('counts pence as pounds, and defaults to USD', () => {
    expect(
      autoHomeCurrency([
        { currency: 'GBp', value: 30_000 }, // £300
        { currency: 'USD', value: 400 },
      ]),
    ).toBe('USD');
    expect(autoHomeCurrency([])).toBe('USD');
  });
});

describe('pairsNeeded', () => {
  it('lists each foreign currency once, minor units folded in', () => {
    expect(pairsNeeded(['USD', 'GBp', 'CAD', 'GBP', 'USD'], 'CAD')).toEqual(['GBP/CAD', 'USD/CAD']);
  });
});
