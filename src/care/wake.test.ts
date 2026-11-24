import { describe, expect, it } from 'vitest';
import { WAKE, WAKE_LENGTH, dozing, localDay, wakeFace } from './wake';

describe('localDay', () => {
  it('is the local calendar date', () => {
    expect(localDay(new Date(2026, 10, 24, 23, 59))).toBe('2026-11-24');
    expect(localDay(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05');
  });
});

describe('dozing', () => {
  const morning = new Date(2026, 10, 24, 8, 0);

  it('dozes once a day until woken', () => {
    expect(dozing({}, morning)).toBe(true);
    expect(dozing({ lastWoken: '2026-11-23' }, morning)).toBe(true);
    expect(dozing({ lastWoken: '2026-11-24' }, morning)).toBe(false);
  });

  it('never dozes with the wake-up turned off, or before settings load', () => {
    expect(dozing({ wakeUp: false }, morning)).toBe(false);
    expect(dozing(undefined, morning)).toBe(false);
  });
});

describe('wakeFace', () => {
  it('sleeps until its turn, then wakes', () => {
    expect(wakeFace(0.1, 0.5, false)).toBe('sleeping');
    expect(wakeFace(0.6, 0.5, false)).toBeUndefined();
  });

  it('on a closed market: shows its mood for a moment, then dozes off again', () => {
    expect(wakeFace(1.5, 0.5, true)).toBe('mood');
    expect(wakeFace(0.5 + WAKE.drowsy + 0.01, 0.5, true)).toBeUndefined();
  });

  it('is over for every shark within the wake-up’s length', () => {
    expect(wakeFace(WAKE_LENGTH, WAKE.stagger, true)).toBeUndefined();
  });
});
