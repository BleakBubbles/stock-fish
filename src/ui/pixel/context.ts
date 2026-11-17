import { createContext, useContext } from 'react';
import { type PixelGrid, computePixelGrid } from './scale';

/**
 * devicePixelRatio, rounded to 1/1000: some environments (e.g. device
 * emulation) report 2.0000000596 for 2, which would make every CSS length
 * slightly off. Real ratios (1.25, 2.625, 3, ...) are unaffected.
 */
export function readDpr(): number {
  return Math.round((window.devicePixelRatio || 1) * 1000) / 1000;
}

export function readPixelGrid(): PixelGrid {
  return computePixelGrid(window.innerWidth, window.innerHeight, readDpr());
}

export const PixelScaleContext = createContext<PixelGrid>({
  dpr: 1,
  tank: 1,
  ui: 2,
  cols: 160,
  rows: 90,
});

/** The current pixel grid (device pixels per tank and per UI pixel). */
export function usePixelScale(): PixelGrid {
  return useContext(PixelScaleContext);
}
