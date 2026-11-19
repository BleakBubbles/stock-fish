/**
 * The reference tank size in art pixels (CLAUDE.md, firm rule 4): the pixel
 * scale is chosen so a tank this size fits, then the tank grows to fill its
 * space at that scale (tankSize).
 */
export const TANK_WIDTH = 320;
export const TANK_HEIGHT = 180;

/** The smallest tank, art pixels: below this the scale steps down instead. */
export const MIN_TANK = { w: 240, h: 135 } as const;
/**
 * At most this tall for its width: a phone held upright gets a tall tank, but
 * not a narrow well.
 */
export const MAX_TALL = 1.5;
/** UI pixels of room around the tank, so its frame stays off the edges. */
export const TANK_PAD = 4;
/** Zooming in goes up to this many times the normal scale. */
export const MAX_ZOOM = 2;
/** A zoomed-in tank may be this small in art pixels (bigger on screen, so fine). */
export const MIN_ZOOMED_TANK = { w: 160, h: 100 } as const;
/** At most this wide for its height (ultra-wide windows). */
export const MAX_WIDE = 2.4;

/**
 * The tank's size in art pixels and its scale, filling a box of device pixels:
 * the preferred whole-number scale (stepping down while even the smallest
 * tank wouldn't fit), then as many whole art pixels as fit, within the shape
 * limits above. Always whole numbers, so the pixels stay crisp.
 */
export function tankSize(
  boxWidth: number,
  boxHeight: number,
  preferredScale: number,
  min: { w: number; h: number } = MIN_TANK,
): { scale: number; width: number; height: number } {
  let scale = Math.max(1, Math.floor(preferredScale));
  while (scale > 1 && (boxWidth / scale < min.w || boxHeight / scale < min.h)) scale--;
  let width = Math.max(min.w, Math.floor(boxWidth / scale));
  let height = Math.max(min.h, Math.floor(boxHeight / scale));
  height = Math.max(min.h, Math.min(height, Math.floor(width * MAX_TALL)));
  width = Math.max(min.w, Math.min(width, Math.floor(height * MAX_WIDE)));
  return { scale, width, height };
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
