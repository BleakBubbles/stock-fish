/** Native tank resolution in art pixels (CLAUDE.md, firm rule 4). */
export const TANK_WIDTH = 320;
export const TANK_HEIGHT = 180;

/** Largest whole-number scale at which the tank fits the given box (minimum 1). */
export function integerScale(boxWidth: number, boxHeight: number): number {
  return Math.max(1, Math.floor(Math.min(boxWidth / TANK_WIDTH, boxHeight / TANK_HEIGHT)));
}

/** Strength of the "light off" overlay when the market is closed (0–1). */
export const NIGHT_ALPHA = 0.55;

/**
 * The tank frame (art/decor/frame.grid) in art pixels: the lid along the top,
 * the glass edges at the sides, and the rim and stand along the bottom.
 */
export const FRAME = { lid: 5, side: 2, bottom: 10 } as const;

/** Average depth of the sand floor, in art pixels. */
export const SAND_DEPTH = 10;
/** Art pixels a fish may dip below the sand line (its sprite has empty rows at the bottom). */
export const SAND_OVERLAP = 2;

/** Extra art pixels around a fish that still count as tapping it (easier on touch). */
export const TAP_SLOP = 2;
