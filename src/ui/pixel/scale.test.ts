import { describe, expect, it } from 'vitest';
import { computePixelGrid, computePixelScale, uiMultiplier } from './scale';

describe('pixel scale', () => {
  it('laptop at 1.5×: UI pixel = tank pixel = 3 device px', () => {
    expect(computePixelScale(787, 892, 1.5)).toEqual({ dpr: 1.5, tank: 3, ui: 3 });
  });

  it('phone at 3×: tank 3 device px, UI doubled so text stays readable', () => {
    expect(computePixelScale(390, 844, 3)).toEqual({ dpr: 3, tank: 3, ui: 6 });
  });

  it('1080p monitor: limited by height once the chrome is counted', () => {
    // 5× needs 900 + 60 × 5 = 1200 > 1080 rows; 4× needs 720 + 240 = 960.
    expect(computePixelScale(1920, 1080, 1)).toEqual({ dpr: 1, tank: 4, ui: 4 });
  });

  it('never goes below 1', () => {
    expect(computePixelScale(200, 100, 1).tank).toBe(1);
  });

  it('multiplier keeps capitals at least 9 CSS px', () => {
    expect(uiMultiplier(3, 1.5, 5)).toBe(1); // 10 px
    expect(uiMultiplier(3, 3, 5)).toBe(2); // 5 → 10 px
    expect(uiMultiplier(1, 1, 5)).toBe(2); // 5 → 10 px
  });

  it('pixel root covers the viewport in whole UI pixels', () => {
    // 1280 × 1.5 = 1920 device px; ui 4 → 480 columns exactly.
    const grid = computePixelGrid(1280, 720, 1.5);
    expect(grid.cols * grid.ui).toBeGreaterThanOrEqual(1280 * 1.5);
    expect((grid.cols - 1) * grid.ui).toBeLessThan(1280 * 1.5);
    expect((grid.rows - 1) * grid.ui).toBeLessThan(720 * 1.5);
    // Android 2.625: 412 CSS px = 1081.5 device px, partly covered by the last column.
    const phone = computePixelGrid(412, 915, 2.625);
    expect(phone.cols).toBe(Math.ceil(1081.5 / phone.ui));
  });
});
