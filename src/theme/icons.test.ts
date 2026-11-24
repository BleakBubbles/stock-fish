import { describe, expect, it } from 'vitest';
import { logoColours } from './index';
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
  it('is no taller than the title bar’s buttons, drawn only in the tooth’s colours', () => {
    expect(LOGO.length).toBeLessThanOrEqual(15);
    for (const row of LOGO) {
      expect(row).toHaveLength(LOGO[0]!.length);
      for (const ch of row) if (ch !== '.') expect(logoColours[ch], ch).toBeDefined();
    }
  });
});
