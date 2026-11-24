import { describe, expect, it } from 'vitest';
import { goldHearts, hearts, isValidBond, mergeBonds, visit, visitedOn } from './bond';

describe('hearts', () => {
  it('are earned at 3, 10, 30, 60 and 100 days fed', () => {
    expect([0, 2, 3, 9, 10, 29, 30, 60, 99, 100, 500].map(hearts)).toEqual([
      0, 0, 1, 1, 2, 2, 3, 4, 4, 5, 5,
    ]);
  });

  it('then turn gold one by one, all gold after a year', () => {
    expect([100, 149, 150, 200, 299, 300, 364, 365, 1000].map(goldHearts)).toEqual([
      0, 0, 1, 2, 3, 4, 4, 5, 5,
    ]);
  });
});

describe('visit', () => {
  it('adds a day once per day, and a missed day costs nothing', () => {
    const a = visit(undefined, '2026-11-24');
    expect(a).toEqual({ days: 1, lastVisit: '2026-11-24' });
    expect(visit(a, '2026-11-24')).toBe(a);
    expect(visit(a, '2026-11-27')).toEqual({ days: 2, lastVisit: '2026-11-27' });
    expect(visitedOn(a, '2026-11-24')).toBe(true);
    expect(visitedOn(undefined, '2026-11-24')).toBe(false);
  });
});

describe('mergeBonds', () => {
  it('keeps the stronger bond and the latest visit', () => {
    expect(
      mergeBonds({ days: 4, lastVisit: '2026-11-20' }, { days: 9, lastVisit: '2026-11-18' }),
    ).toEqual({ days: 9, lastVisit: '2026-11-20' });
    expect(mergeBonds(undefined, { days: 2 })).toEqual({ days: 2 });
  });
});

describe('isValidBond', () => {
  it('accepts whole day counts and ISO days only', () => {
    expect(isValidBond({ days: 3, lastVisit: '2026-11-24' })).toBe(true);
    expect(isValidBond({ days: 0 })).toBe(true);
    expect(isValidBond({ days: -1 })).toBe(false);
    expect(isValidBond({ days: 1.5 })).toBe(false);
    expect(isValidBond({ days: 1, lastVisit: 'Tuesday' })).toBe(false);
    expect(isValidBond('3')).toBe(false);
  });
});
