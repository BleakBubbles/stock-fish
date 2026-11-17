import { describe, expect, it } from 'vitest';
import { formatChangeRatio, formatMoney } from './format';

// Locale-dependent output: check the parts that don't vary.
describe('format', () => {
  it('signs percentage changes', () => {
    expect(formatChangeRatio(0.0123)).toMatch(/^\+1[.,]23\s?%$/);
    expect(formatChangeRatio(-0.005)).toMatch(/^[-−]0[.,]50\s?%$/);
    expect(formatChangeRatio(0)).toMatch(/^0[.,]00\s?%$/);
    expect(formatChangeRatio(NaN)).toBe('–');
  });

  it('formats money with or without a currency', () => {
    expect(formatMoney(1234.5, 'USD')).toContain('1');
    expect(formatMoney(1234.5, 'USD')).toMatch(/\$|US/);
    expect(formatMoney(12.3, undefined, true)).toMatch(/^\+12[.,]30$/);
    expect(formatMoney(-12.3, 'USD', true)).toMatch(/^[-−]/);
    expect(formatMoney(5, 'NOT-A-CODE')).toMatch(/^5[.,]00$/);
    expect(formatMoney(Infinity)).toBe('–');
  });
});
