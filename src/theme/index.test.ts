import { describe, expect, it } from 'vitest';
import {
  colours,
  defaultColours,
  fishColours,
  fnv1a,
  isPaletteColour,
  rampOrder,
  ramps,
  ui,
} from './index';

describe('palette', () => {
  it('has 32 colours', () => {
    expect(colours).toHaveLength(32);
  });

  it('every ramp colour is a palette colour', () => {
    for (const ramp of Object.values(ramps)) {
      expect(colours).toContain(ramp.body);
      expect(colours).toContain(ramp.fin);
    }
  });

  it('no ramp uses the water colour', () => {
    for (const ramp of Object.values(ramps)) {
      expect([ramp.body, ramp.fin]).not.toContain(ui.water);
    }
  });

  it('rampOrder names only existing ramps', () => {
    for (const name of rampOrder) expect(ramps[name]).toBeDefined();
  });
});

describe('fnv1a', () => {
  it('matches known vectors', () => {
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).toBe(0xe40c292c);
    expect(fnv1a('foobar')).toBe(0xbf9cf968);
  });
});

describe('defaultColours', () => {
  it('is stable and case-insensitive', () => {
    expect(defaultColours('aapl')).toEqual(defaultColours('AAPL'));
    expect(defaultColours(' msft ')).toEqual(defaultColours('MSFT'));
  });

  it('returns a ramp from the palette', () => {
    const { primary, secondary } = defaultColours('VTI');
    expect(Object.values(ramps)).toContainEqual({ body: primary, fin: secondary });
  });
});

describe('fishColours', () => {
  it('uses each chosen slot and falls back per slot', () => {
    const d = defaultColours('AAPL');
    expect(fishColours({ symbol: 'AAPL' })).toEqual(d);
    expect(fishColours({ symbol: 'AAPL', primary: '262b44' })).toEqual({
      primary: '262b44',
      secondary: d.secondary,
    });
  });
});

describe('ui colours', () => {
  it('are all palette colours', () => {
    for (const hex of Object.values(ui)) expect(isPaletteColour(hex)).toBe(true);
  });
});
