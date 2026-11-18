/**
 * The app's pixel grid (CLAUDE.md, firm rule 4), measured in device pixels so
 * every art pixel is a whole number of screen pixels at any devicePixelRatio.
 *
 * - tank: device pixels per tank art pixel (the largest whole number that fits).
 * - ui: device pixels per UI pixel = tank × the smallest whole number that keeps
 *   capitals at least MIN_CAP_CSS tall. On laptops that's 1 (UI = tank); on
 *   phones, where the tank pixel is ~1 CSS px, it's 2.
 */
import { TANK_HEIGHT, TANK_WIDTH } from '../../tank/constants';
import { uiFont } from '../../theme/pixelFont';

/** Smallest readable capital letter, in CSS pixels. */
export const MIN_CAP_CSS = 9;

/**
 * UI pixels of chrome stacked above the tank when each bar fits on one line:
 * top bar 22 (padding 3 + button 15 + padding 3 + line 1) + pen bar 22 (the
 * same) + weather bar 16 (padding 3 + text 9 + padding 3 + line 1).
 */
export const CHROME_UI_ROWS = 60;

export interface PixelScale {
  dpr: number;
  /** Device pixels per tank art pixel. */
  tank: number;
  /** Device pixels per UI pixel (a whole multiple of `tank`). */
  ui: number;
}

export function uiMultiplier(tank: number, dpr: number, capHeight = uiFont.capHeight): number {
  let m = 1;
  while ((capHeight * tank * m) / dpr < MIN_CAP_CSS && m < 8) m++;
  return m;
}

/** Pick the scales for a viewport of `width` × `height` CSS pixels. */
export function computePixelScale(width: number, height: number, dpr: number): PixelScale {
  const deviceW = width * dpr;
  const deviceH = height * dpr;
  for (let tank = Math.max(1, Math.floor(deviceW / TANK_WIDTH)); tank > 1; tank--) {
    const ui = tank * uiMultiplier(tank, dpr);
    if (TANK_WIDTH * tank <= deviceW && TANK_HEIGHT * tank + CHROME_UI_ROWS * ui <= deviceH) {
      return { dpr, tank, ui };
    }
  }
  return { dpr, tank: 1, ui: uiMultiplier(1, dpr) };
}

/**
 * The pixel grid plus the size of the pixel root (PixelRoot) in UI pixels:
 * enough whole UI pixels to cover the viewport. The last column and row may
 * hang off the right and bottom edges by less than one UI pixel.
 */
export interface PixelGrid extends PixelScale {
  cols: number;
  rows: number;
}

export function computePixelGrid(width: number, height: number, dpr: number): PixelGrid {
  const scale = computePixelScale(width, height, dpr);
  // The epsilon keeps float noise (e.g. 1279.9999 × 1.5) from adding a column.
  const cover = (css: number) => Math.max(1, Math.ceil((css * dpr) / scale.ui - 1e-6));
  return { ...scale, cols: cover(width), rows: cover(height) };
}
