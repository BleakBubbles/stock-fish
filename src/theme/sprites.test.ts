import { describe, expect, it } from 'vitest';
import { FAMILIES, bodyForSector, familyLabel } from './bodies';
import { ROLES, SPRITE_HEIGHT, SPRITE_WIDTH, allSprites, spriteColours } from './sprites';
import { parseGrid } from './grid';

describe('sprites', () => {
  it('loads all 30 body × mood grids at 32 × 25 using only legal roles', () => {
    const all = allSprites();
    expect(all).toHaveLength(30);
    for (const { body, mood, rows } of all) {
      expect(rows, `${body}/${mood}`).toHaveLength(SPRITE_HEIGHT);
      for (const row of rows) {
        expect(row, `${body}/${mood}`).toHaveLength(SPRITE_WIDTH);
        for (const ch of row) expect(ROLES).toContain(ch);
      }
    }
  });

  it('parseGrid drops comments and blank lines', () => {
    expect(parseGrid('# c\r\n..\r\n\r\noo\n')).toEqual(['..', 'oo']);
  });

  it('maps body and fin roles to the fish colours', () => {
    const c = spriteColours('f77622', 'feae34');
    expect(c.B).toBe('f77622');
    expect(c.F).toBe('feae34');
    expect(c.o).toBe('181425');
    expect(c.w).toBe('ffffff');
  });
});

describe('bodyForSector', () => {
  it.each([
    ['Technology', 1],
    ['Information Technology', 1],
    ['Communication Services', 1],
    ['Financial Services', 2],
    ['Real Estate', 2],
    ['Consumer Cyclical', 3],
    ['Consumer Staples', 3],
    ['Energy', 4],
    ['Utilities', 4],
    ['Industrials', 5],
    ['Basic Materials', 5],
    ['Healthcare', 6],
    [' health care ', 6],
    ['Something new', 3],
    [undefined, 3],
  ])('%s → body %i', (sector, body) => {
    expect(bodyForSector(sector)).toBe(body);
  });
});

describe('families', () => {
  it('each family sector maps back to its own body', () => {
    expect(FAMILIES.map((f) => bodyForSector(f.sector))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('labels sectors by family', () => {
    expect(familyLabel('Technology')).toBe('Tech & communication');
    expect(familyLabel('Consumer Staples')).toBe('Consumer');
    expect(familyLabel('Fund')).toBe('Fund');
    expect(familyLabel(undefined)).toBe('Unknown');
    expect(familyLabel('Weird')).toBe('Unknown');
  });
});
