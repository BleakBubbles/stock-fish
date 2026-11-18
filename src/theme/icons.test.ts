import { describe, expect, it } from 'vitest';
import { ICONS, LOGO } from './sprites';

describe('button icons', () => {
  it('are 7 × 7 grids of ink (x) and clear (.)', () => {
    expect(Object.keys(ICONS).length).toBeGreaterThanOrEqual(16);
    for (const [name, rows] of Object.entries(ICONS)) {
      expect(rows, name).toHaveLength(7);
      for (const row of rows) expect(row, name).toMatch(/^[x.]{7}$/);
    }
  });

  it('includes every icon the buttons use', () => {
    for (const name of ['close', 'plus', 'edit', 'colours', 'tank', 'holdings', 'settings']) {
      expect(ICONS[name], name).toBeDefined();
    }
  });
});

describe('logo', () => {
  it('fits the 9-pixel text line', () => {
    expect(LOGO).toHaveLength(9);
  });
});
