import { describe, expect, it } from 'vitest';
import { direction, directionIcon, directionTone } from './change';

describe('today’s change marks', () => {
  it('reads the direction from the sign', () => {
    expect(direction(0.012)).toBe('up');
    expect(direction(-0.004)).toBe('down');
    expect(direction(0)).toBe('flat');
    expect(direction(Number.NaN)).toBe('flat');
  });

  it('draws an arrow only when the price moved', () => {
    expect(directionIcon('up')).toBe('up');
    expect(directionIcon('down')).toBe('down');
    expect(directionIcon('flat')).toBeUndefined();
  });

  it('colours up green and down red, or the other way round when chosen', () => {
    expect(directionTone('up')).toBe('changeGreen');
    expect(directionTone('down')).toBe('changeRed');
    expect(directionTone('up', 'red')).toBe('changeRed');
    expect(directionTone('down', 'red')).toBe('changeGreen');
    expect(directionTone('flat', 'red')).toBe('text');
  });
});
