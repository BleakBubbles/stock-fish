import { describe, expect, it } from 'vitest';
import { integerScale } from './constants';

describe('integerScale', () => {
  it('picks the largest whole scale that fits', () => {
    expect(integerScale(1920, 1080)).toBe(6);
    expect(integerScale(1280, 720)).toBe(4);
    expect(integerScale(1279, 720)).toBe(3);
    expect(integerScale(390, 844)).toBe(1);
  });

  it('never goes below 1', () => {
    expect(integerScale(100, 100)).toBe(1);
  });
});
