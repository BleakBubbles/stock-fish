import { describe, expect, it } from 'vitest';
import {
  caretIndexAt,
  caretOffsets,
  measureText,
  normalizeText,
  parseFont,
  uiFont,
  wrapText,
} from './pixelFont';

describe('parseFont', () => {
  it('reads the Silkscreen grid', () => {
    expect(uiFont.height).toBe(9);
    expect(uiFont.baseline).toBe(8);
    expect(uiFont.capHeight).toBe(5);
    expect(uiFont.glyphs.size).toBe(101);
    for (const ch of 'AZaz09 %$+-.,()') expect(uiFont.glyphs.has(ch), ch).toBe(true);
    for (const [ch, g] of uiFont.glyphs) {
      expect(g.rows, ch).toHaveLength(9);
      expect(g.advance, ch).toBeGreaterThan(0);
    }
  });

  it('rejects malformed glyphs', () => {
    expect(() => parseFont('height 2\nbaseline 1\n= space\n..\n')).toThrow(/rows/);
    expect(() => parseFont('height 1\nbaseline 1\n= space\n..\n\n= A\n#\n#\n')).toThrow(/rows/);
    expect(() => parseFont('height 1\nbaseline 1\n= space\n..\nxx\n')).toThrow(/Unexpected/);
  });
});

describe('text', () => {
  it('substitutes characters the font lacks', () => {
    const minus = String.fromCodePoint(0x2212);
    const nbsp = String.fromCodePoint(0x00a0);
    expect(normalizeText(uiFont, `${minus}1.2${nbsp}%`)).toBe('-1.2 %');
    expect(normalizeText(uiFont, '‘hi’ 日本')).toBe("'hi' ??");
  });

  it('measures by glyph advance', () => {
    expect(measureText(uiFont, 'H')).toBe(6);
    expect(measureText(uiFont, 'HI')).toBe(9);
    expect(measureText(uiFont, '')).toBe(0);
  });

  it('wraps at spaces and splits overlong words', () => {
    const w = measureText(uiFont, 'Calm today');
    expect(wrapText(uiFont, 'Calm today', w)).toEqual(['Calm today']);
    expect(wrapText(uiFont, 'Calm today', w - 1)).toEqual(['Calm', 'today']);
    const narrow = wrapText(uiFont, 'ABCDEFGH', measureText(uiFont, 'ABC'));
    expect(narrow.join('')).toBe('ABCDEFGH');
    for (const line of narrow)
      expect(measureText(uiFont, line)).toBeLessThanOrEqual(measureText(uiFont, 'ABC'));
    expect(wrapText(uiFont, 'a\nb', 100)).toEqual(['a', 'b']);
  });
});

describe('caret offsets', () => {
  it('maps caret positions to font pixels and back', () => {
    const offsets = caretOffsets(uiFont, 'AB');
    const a = measureText(uiFont, 'A');
    expect(offsets).toEqual([0, a, a + measureText(uiFont, 'B')]);
    expect(caretIndexAt(offsets, a - 1)).toBe(1);
    expect(caretIndexAt(offsets, -5)).toBe(0);
    expect(caretIndexAt(offsets, 999)).toBe(2);
  });

  it('gives a surrogate pair one glyph of width', () => {
    const offsets = caretOffsets(uiFont, 'A\u{1F41F}');
    expect(offsets).toHaveLength(4);
    expect(offsets[2]).toBe(offsets[3]);
  });
});
