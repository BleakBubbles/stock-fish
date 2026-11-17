import { describe, expect, it } from 'vitest';
import { colours, defaultColours, fnv1a, rampOrder, ramps, ui } from './index';

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
