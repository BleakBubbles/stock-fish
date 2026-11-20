import { describe, expect, it } from 'vitest';
import type { FishView } from '../tank/model';
import { describeFish } from './describeFish';

const base: FishView = {
  id: 'h1',
  symbol: 'AAPL',
  name: 'Apple Inc.',
  quantity: 10,
  penId: 'p1',
  body: 1,
  primary: 'ffffff',
  secondary: '000000',
  mood: 'neutral',
  state: 'loading',
};

describe('describeFish', () => {
  it('reads the numbers a price board would show, never just a colour', () => {
    const text = describeFish(
      {
        ...base,
        state: 'ok',
        mood: 'happy',
        quote: {
          symbol: 'AAPL',
          price: 200,
          previousClose: 196,
          timestamp: 0,
          tradingDay: '2026-11-17',
          marketOpen: false,
          currency: 'USD',
        },
        moodResult: { mood: 'happy', todayReturn: 0.0204, reason: 'ok', sigma: 0.015, z: 1.36 },
      },
      'TFSA',
    );
    expect(text).toMatch(/^AAPL, Apple Inc\., happy, \+2\.04% today, .*2,000.*, in TFSA$/);
  });

  it('says when its market is closed', () => {
    expect(describeFish(base, 'TFSA', 'London')).toBe(
      'AAPL, Apple Inc., waiting for prices, asleep, London market closed, in TFSA',
    );
  });

  it('says when there is no price yet', () => {
    expect(describeFish(base)).toBe('AAPL, Apple Inc., waiting for prices');
    expect(describeFish({ ...base, state: 'error' })).toBe('AAPL, Apple Inc., no price');
  });
});
