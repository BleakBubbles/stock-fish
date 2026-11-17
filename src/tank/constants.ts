/** Native tank resolution in art pixels (CLAUDE.md, firm rule 4). */
export const TANK_WIDTH = 320;
export const TANK_HEIGHT = 180;

/** Largest whole-number scale at which the tank fits the given box (minimum 1). */
export function integerScale(boxWidth: number, boxHeight: number): number {
  return Math.max(1, Math.floor(Math.min(boxWidth / TANK_WIDTH, boxHeight / TANK_HEIGHT)));
}

/** Strength of the "light off" overlay when the market is closed (0–1). */
export const NIGHT_ALPHA = 0.55;

/** Art pixels kept clear at the top and bottom of the tank. */
export const TANK_MARGIN_TOP = 6;
export const TANK_MARGIN_BOTTOM = 4;

/** Extra art pixels around a fish that still count as tapping it (easier on touch). */
export const TAP_SLOP = 2;
