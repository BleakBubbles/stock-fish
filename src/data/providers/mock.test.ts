import { describe, expect, it } from 'vitest';
import { assessMood } from '../../mood';
import { MOCK_PROFILES, MOCK_UNKNOWN, createMockProvider } from './mock';

const NOW = Date.UTC(2026, 10, 17, 18); // a Tuesday

describe('mock provider', () => {
  const p = createMockProvider({ now: () => NOW });

  it('is deterministic', async () => {
    const q = createMockProvider({ now: () => NOW });
    expect(await p.getDailyHistory('AAPL', 60)).toEqual(await q.getDailyHistory('aapl', 60));
  });

  it('returns weekday bars, oldest first, ending today', async () => {
    const bars = await p.getDailyHistory('MSFT', 61);
    expect(bars).toHaveLength(61);
    expect(bars.at(-1)!.date).toBe('2026-11-17');
    for (let i = 1; i < bars.length; i++) expect(bars[i]!.date > bars[i - 1]!.date).toBe(true);
    for (const b of bars) expect([0, 6]).not.toContain(new Date(b.date).getUTCDay());
  });

  it('quote matches the last two bars', async () => {
    const bars = await p.getDailyHistory('XOM', 2);
    const quote = await p.getQuote('XOM');
    expect(quote.price).toBe(bars[1]!.close);
    expect(quote.previousClose).toBe(bars[0]!.close);
  });

  it('knows fixture sectors and refuses the unknown symbol', async () => {
    expect((await p.getProfile!('JNJ')).sector).toBe('Healthcare');
    expect(await p.getProfile!('ZZZZ')).toEqual({});
    await expect(p.getQuote(MOCK_UNKNOWN)).rejects.toMatchObject({ kind: 'not-found' });
  });
});

describe('mock provider with the mood engine', () => {
  // The tank needs to show a spread of faces when developing offline.
  it('gives a range of moods across the fixture symbols', async () => {
    const p = createMockProvider({ now: () => NOW });
    const moods = new Set<string>();
    for (const symbol of Object.keys(MOCK_PROFILES)) {
      const quote = await p.getQuote(symbol);
      const history = await p.getDailyHistory(symbol, 61);
      const result = assessMood({ ...quote, history, asOf: quote.tradingDay });
      expect(result.reason).toBe('ok');
      moods.add(result.mood);
    }
    expect(moods.size).toBeGreaterThanOrEqual(3);
  });
});

describe('mock currencies', () => {
  it('prices by exchange suffix, with rates between them', async () => {
    const p = createMockProvider({ now: () => Date.UTC(2026, 10, 17, 20) });
    expect((await p.getQuote('RY:TSX')).currency).toBe('CAD');
    expect((await p.getQuote('VOD:LSE')).currency).toBe('GBp');
    expect((await p.getQuote('AAPL')).currency).toBe('USD');
    const usdCad = await p.getExchangeRate?.('USD', 'CAD');
    expect(usdCad?.rate).toBeCloseTo(1 / 0.72);
  });
});
