import { describe, expect, it } from 'vitest';
import {
  CRYPTO,
  FOREX,
  US,
  closedMarketsText,
  exchangeFor,
  isRegularSession,
  lastSettledClose,
  marketOpenNow,
  marketStates,
  newYorkTime,
} from './market';

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

describe('exchangeFor', () => {
  it("prefers the quote's market code, then its exchange name, then the symbol's suffix", () => {
    expect(exchangeFor('AAPL', { mic: 'XNGS', exchange: 'NASDAQ' }).name).toBe('US');
    expect(exchangeFor('VOD', { mic: 'XLON' }).name).toBe('London');
    expect(exchangeFor('RY', { exchange: 'TSX' }).name).toBe('Toronto');
    expect(exchangeFor('7203:TSE').name).toBe('Tokyo');
    expect(exchangeFor('BHP.AX').name).toBe('Sydney');
    expect(exchangeFor('SAP:XETR').name).toBe('Xetra');
  });

  it('keeps US hours for markets it does not know', () => {
    expect(exchangeFor('2222', { mic: 'XSAU' })).toBe(US);
    expect(exchangeFor('AAPL')).toBe(US);
  });
});

describe('other markets', () => {
  const tokyo = exchangeFor('X:TSE');
  const london = exchangeFor('X:LSE');

  it("opens on the market's own clock", () => {
    // Tue 2026-11-17 01:00 UTC is 10:00 Tuesday in Tokyo (Monday evening in New York).
    expect(isRegularSession(Date.UTC(2026, 10, 17, 1), tokyo)).toBe(true);
    expect(isRegularSession(Date.UTC(2026, 10, 17, 1))).toBe(false);
    // 07:00 UTC is 16:00 in Tokyo: closed.
    expect(isRegularSession(Date.UTC(2026, 10, 17, 7), tokyo)).toBe(false);
    // Friday 23:00 New York is Saturday in Tokyo.
    expect(isRegularSession(Date.UTC(2026, 10, 21, 1), tokyo)).toBe(false);
  });

  it('follows its own daylight saving time', () => {
    // London 08:00: 08:00 UTC in November, 07:00 UTC in July.
    expect(isRegularSession(Date.UTC(2026, 10, 17, 7, 59), london)).toBe(false);
    expect(isRegularSession(Date.UTC(2026, 10, 17, 8), london)).toBe(true);
    expect(isRegularSession(Date.UTC(2026, 6, 14, 7), london)).toBe(true);
  });

  it("settles after the market's own close", () => {
    // Tokyo closes 15:30 (06:30 UTC), settled 06:50 UTC.
    expect(lastSettledClose(Date.UTC(2026, 10, 17, 12), tokyo)).toBe(Date.UTC(2026, 10, 17, 6, 50));
    expect(lastSettledClose(Date.UTC(2026, 10, 17, 3), tokyo)).toBe(Date.UTC(2026, 10, 16, 6, 50));
  });
});

describe('marketStates', () => {
  // 10:00 New York = 15:00 London, both open.
  const now = nov(10);
  const quote = (mic: string, marketOpen?: boolean) => ({
    quote: { mic, ...(marketOpen === undefined ? {} : { marketOpen }) },
    quoteAt: nov(9, 45),
  });

  it("gives each symbol its market's state", () => {
    const states = marketStates(
      now,
      ['AAPL', 'VOD', '7203'],
      new Map([
        ['AAPL', quote('XNGS')],
        ['VOD', quote('XLON')],
        ['7203', quote('XTKS')],
      ]),
    );
    expect(states.get('AAPL')).toMatchObject({ open: true, exchange: { name: 'US' } });
    expect(states.get('VOD')).toMatchObject({ open: true, exchange: { name: 'London' } });
    expect(states.get('7203')).toMatchObject({ open: false, exchange: { name: 'Tokyo' } });
  });

  it("lets one market's quotes declare its holiday, not another's", () => {
    const states = marketStates(
      now,
      ['AAPL', 'VOD'],
      new Map([
        ['AAPL', quote('XNGS', true)],
        ['VOD', quote('XLON', false)],
      ]),
    );
    expect(states.get('AAPL')?.open).toBe(true);
    expect(states.get('VOD')?.open).toBe(false);
  });
});

describe('closedMarketsText', () => {
  const state = (symbol: string, open: boolean) => ({ exchange: exchangeFor(symbol), open });

  it('names what is closed', () => {
    expect(closedMarketsText([state('A', true)])).toBeUndefined();
    expect(closedMarketsText([state('A', false), state('B', false)])).toBe('Market closed');
    expect(closedMarketsText([state('A', false), state('B:LSE', false)])).toBe('Markets closed');
    expect(closedMarketsText([state('A', true), state('B:LSE', false)])).toBe('London closed');
    expect(
      closedMarketsText([state('A', true), state('B:LSE', false), state('C:TSE', false)]),
    ).toBe('2 markets closed');
  });
});

describe('crypto and currencies', () => {
  it('tells crypto pairs from currency pairs', () => {
    expect(exchangeFor('BTC/USD', { exchange: 'Binance' })).toBe(CRYPTO);
    expect(exchangeFor('eth/btc')).toBe(CRYPTO);
    expect(exchangeFor('EUR/USD')).toBe(FOREX);
    expect(exchangeFor('XAU/USD')).toBe(FOREX);
  });

  it('never closes crypto, and settles each UTC day', () => {
    expect(isRegularSession(Date.UTC(2026, 10, 21, 3), CRYPTO)).toBe(true); // Saturday night
    expect(lastSettledClose(Date.UTC(2026, 10, 21, 3), CRYPTO)).toBe(Date.UTC(2026, 10, 21, 0, 20));
    expect(lastSettledClose(Date.UTC(2026, 10, 21, 0, 10), CRYPTO)).toBe(
      Date.UTC(2026, 10, 20, 0, 20),
    );
  });

  it('trades currencies from Sunday 17:00 to Friday 17:00 New York time', () => {
    expect(isRegularSession(nov(16, 59, 20), FOREX)).toBe(true); // Friday
    expect(isRegularSession(nov(17, 0, 20), FOREX)).toBe(false);
    expect(isRegularSession(nov(12, 0, 21), FOREX)).toBe(false); // Saturday
    expect(isRegularSession(nov(16, 59, 22), FOREX)).toBe(false); // Sunday
    expect(isRegularSession(nov(17, 0, 22), FOREX)).toBe(true);
    expect(isRegularSession(nov(3, 0, 18), FOREX)).toBe(true); // Wednesday night
  });
});
