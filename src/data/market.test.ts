import { describe, expect, it } from 'vitest';
import { isRegularSession, lastSettledClose, marketOpenNow, newYorkTime } from './market';

// 2026-11-17 is a Tuesday; New York is on EST (UTC−5). 2026-07-14 is a Tuesday on EDT (UTC−4).
const nov = (h: number, m = 0, day = 17) => Date.UTC(2026, 10, day, h + 5, m);
const jul = (h: number, m = 0, day = 14) => Date.UTC(2026, 6, day, h + 4, m);

describe('newYorkTime', () => {
  it('converts to New York wall-clock time across DST', () => {
    expect(newYorkTime(nov(9, 30))).toMatchObject({ date: '2026-11-17', weekday: 2, minute: 570 });
    expect(newYorkTime(jul(16))).toMatchObject({ date: '2026-07-14', minute: 960 });
    expect(newYorkTime(Date.UTC(2026, 10, 18, 3))).toMatchObject({ date: '2026-11-17' });
  });
});

describe('isRegularSession', () => {
  it.each([
    [nov(9, 29), false],
    [nov(9, 30), true],
    [nov(15, 59), true],
    [nov(16), false],
    [jul(12), true],
    [nov(12, 0, 21), false], // Saturday
    [nov(12, 0, 22), false], // Sunday
  ])('%i → %s', (ms, open) => {
    expect(isRegularSession(ms)).toBe(open);
  });
});

describe('lastSettledClose', () => {
  it('is today at 16:20 once that has passed', () => {
    expect(lastSettledClose(nov(17))).toBe(nov(16, 20));
    expect(lastSettledClose(jul(16, 20))).toBe(jul(16, 20));
  });

  it("is the previous weekday's before today's close has settled", () => {
    expect(lastSettledClose(nov(10))).toBe(nov(16, 20, 16));
    expect(lastSettledClose(nov(16, 10))).toBe(nov(16, 20, 16));
  });

  it('skips weekends', () => {
    // Monday 2026-11-23 morning → Friday 2026-11-20.
    expect(lastSettledClose(nov(8, 0, 23))).toBe(nov(16, 20, 20));
    expect(lastSettledClose(nov(12, 0, 22))).toBe(nov(16, 20, 20));
  });
});

describe('marketOpenNow', () => {
  it('follows the clock', () => {
    expect(marketOpenNow(nov(11))).toBe(true);
    expect(marketOpenNow(nov(18))).toBe(false);
  });

  it('trusts fresh "closed" quotes during session hours (holidays)', () => {
    const closed = [{ marketOpen: false, fetchedAt: nov(10) }];
    expect(marketOpenNow(nov(11), closed)).toBe(false);
    const mixed = [...closed, { marketOpen: true, fetchedAt: nov(10, 30) }];
    expect(marketOpenNow(nov(11), mixed)).toBe(true);
    const yesterday = [{ marketOpen: false, fetchedAt: nov(17, 0, 16) }];
    expect(marketOpenNow(nov(11), yesterday)).toBe(true);
  });
});
