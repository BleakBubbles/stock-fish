import { describe, expect, it } from 'vitest';
import { FAMILIES, bodyForSector, familyLabel } from './bodies';
import { BODIES, ROLES, SPRITE_HEIGHT, SPRITE_WIDTH, allSprites, spriteColours } from './sprites';
import { parseGrid } from './grid';

describe('sprites', () => {
  it('builds every body × face × tail frame at 32 × 25 using only legal roles', () => {
    const all = allSprites();
    expect(all).toHaveLength(BODIES.length * 6 * 3);
    for (const { body, face, tail, rows } of all) {
      const name = `${body}/${face}/${tail}`;
      expect(rows, name).toHaveLength(SPRITE_HEIGHT);
      for (const row of rows) {
        expect(row, name).toHaveLength(SPRITE_WIDTH);
        for (const ch of row) expect(ROLES).toContain(ch);
      }
    }
  });

  it('outlines every edge: no body, fin or eye-white pixel touches empty water (STYLE rule 3)', () => {
    for (const { body, face, tail, rows } of allSprites()) {
      const at = (x: number, y: number) => rows[y]?.[x] ?? '.';
      for (let y = 0; y < rows.length; y++) {
        for (let x = 0; x < SPRITE_WIDTH; x++) {
          if (!'BFw'.includes(at(x, y))) continue;
          const open = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].includes('.');
          expect(open, `${body}/${face}/${tail} at ${x},${y}`).toBe(false);
        }
      }
    }
  });

  it('keeps the outer row and column clear for the selection ring', () => {
    for (const { body, face, tail, rows } of allSprites()) {
      const edges = [
        rows[0],
        rows.at(-1),
        rows.map((r) => r[0]).join(''),
        rows.map((r) => r.at(-1)).join(''),
      ];
      for (const edge of edges) expect(edge, `${body}/${face}/${tail}`).toMatch(/^\.+$/);
    }
  });

  it('sleeping faces have closed eyes: no eye white', () => {
    for (const { body, face, rows } of allSprites()) {
      if (face === 'sleeping') expect(rows.join(''), `${body}`).not.toContain('w');
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
    ['Fund', 7],
    ['Crypto', 8],
    ['Something new', 3],
    [undefined, 3],
  ])('%s → body %i', (sector, body) => {
    expect(bodyForSector(sector)).toBe(body);
  });
});

describe('families', () => {
  it('each family sector maps back to its own body', () => {
    expect(FAMILIES.map((f) => bodyForSector(f.sector))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('labels sectors by family', () => {
    expect(familyLabel('Technology')).toBe('Tech & communication');
    expect(familyLabel('Consumer Staples')).toBe('Consumer');
    expect(familyLabel('Fund')).toBe('Fund');
    expect(familyLabel(undefined)).toBe('Unknown');
    expect(familyLabel('Weird')).toBe('Unknown');
  });
});
