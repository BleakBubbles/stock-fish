/** Native tank resolution in art pixels (CLAUDE.md, firm rule 4). */
export const TANK_WIDTH = 320;
export const TANK_HEIGHT = 180;

/** Largest whole-number scale at which the tank fits the given box (minimum 1). */
export function integerScale(boxWidth: number, boxHeight: number): number {
  return Math.max(1, Math.floor(Math.min(boxWidth / TANK_WIDTH, boxHeight / TANK_HEIGHT)));
}
