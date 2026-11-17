import { describe, expect, it } from 'vitest';
import { MOCK_UNKNOWN, createMockProvider } from './mock';

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
