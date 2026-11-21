import { describe, expect, it } from 'vitest';
import {
  clampInto,
  defaultSpot,
  placeSpot,
  resolveSpot,
  spotAt,
  spotPath,
  validSpot,
  withSpot,
} from './panelSpot';

const tank = { x: 10, y: 20, w: 300, h: 200 };
const panel = { w: 100, h: 60 };

describe('spotPath', () => {
  it('goes from screen size to grouping, or to single pen and its sort', () => {
    expect(spotPath(false, { kind: 'overview', group: 'mood' })).toEqual([
      'wide',
      'wide/group:mood',
    ]);
    expect(spotPath(true, { kind: 'pen', sort: 'custom' })).toEqual([
      'narrow',
      'narrow/pen',
      'narrow/pen/sort:custom',
    ]);
  });
});

describe('resolveSpot', () => {
  const pen = spotPath(false, { kind: 'pen', sort: 'weight' });

  it('uses the most specific level saved, inheriting from the levels above', () => {
    const a = { corner: 'br', x: 1, y: 2 } as const;
    const b = { corner: 'tr', x: 3, y: 4 } as const;
    expect(resolveSpot({ wide: a }, pen, false)).toEqual(a);
    expect(resolveSpot({ wide: a, 'wide/pen': b }, pen, false)).toEqual(b);
    expect(resolveSpot({ 'wide/pen/sort:custom': b }, pen, false)).toEqual(defaultSpot(false));
  });

  it('falls back to the default, top-left wide and bottom-left narrow', () => {
    expect(resolveSpot(undefined, pen, false)).toEqual({ corner: 'tl', x: 4, y: 4 });
    expect(resolveSpot({}, spotPath(true, { kind: 'pen', sort: 'name' }), true).corner).toBe('bl');
  });

  it('ignores saved values that are not spots', () => {
    expect(validSpot({ corner: 'middle', x: 1, y: 1 })).toBeUndefined();
    expect(validSpot({ corner: 'tl', x: 1.5, y: 1 })).toBeUndefined();
    expect(resolveSpot({ wide: 'oops' }, pen, false)).toEqual(defaultSpot(false));
  });
});

describe('withSpot', () => {
  it('sets this level and the ones above, leaving other branches alone', () => {
    const mood = spotPath(false, { kind: 'overview', group: 'mood' });
    const pen = spotPath(false, { kind: 'overview', group: 'pen' });
    const a = { corner: 'tl', x: 9, y: 9 } as const;
    const b = { corner: 'br', x: 5, y: 5 } as const;
    const spots = withSpot(withSpot(undefined, mood, a), pen, b);
    // Mood keeps its own; Family, never placed, follows the latest (Pen's).
    expect(resolveSpot(spots, mood, false)).toEqual(a);
    expect(
      resolveSpot(spots, spotPath(false, { kind: 'overview', group: 'family' }), false),
    ).toEqual(b);
  });
});

describe('placing', () => {
  it('measures from the spot’s corner of the tank', () => {
    expect(placeSpot({ corner: 'tl', x: 4, y: 4 }, tank, panel)).toEqual({ left: 14, top: 24 });
    expect(placeSpot({ corner: 'br', x: 4, y: 4 }, tank, panel)).toEqual({ left: 206, top: 156 });
  });

  it('keeps the panel inside the tank', () => {
    expect(placeSpot({ corner: 'tl', x: 500, y: 500 }, tank, panel)).toEqual({
      left: 210,
      top: 160,
    });
    expect(clampInto(-50, -50, tank, panel)).toEqual({ left: 10, top: 20 });
    // Bigger than the tank: its top-left stays in view.
    expect(clampInto(100, 100, tank, { w: 400, h: 400 })).toEqual({ left: 10, top: 20 });
  });

  it('remembers a dropped panel by its nearest corner, and puts it back in the same place', () => {
    const spot = spotAt(200, 150, tank, panel);
    expect(spot).toEqual({ corner: 'br', x: 10, y: 10 });
    expect(placeSpot(spot, tank, panel)).toEqual({ left: 200, top: 150 });
    // A bigger tank: still 10 pixels from its bottom-right corner.
    expect(placeSpot(spot, { ...tank, w: 400, h: 300 }, panel)).toEqual({ left: 300, top: 250 });
    expect(spotAt(20, 30, tank, panel)).toEqual({ corner: 'tl', x: 10, y: 10 });
  });
});
