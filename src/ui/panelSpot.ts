/**
 * Where the details panel sits over the tank. The user drags it by its title,
 * and the spot is kept: per screen size (narrow or wide), then per grouping in
 * an overview, or per sort in a single pen. Each level inherits the spot of
 * the level above until the user moves the panel there, and a move also
 * becomes the spot above it, so places never chosen follow the latest one.
 * Pure, in whole UI pixels.
 */
import type { GroupMode, PanelSpot, SortMode } from '../data/model';

export type { PanelSpot };

/** What the tank shows: an overview grouped some way, or a single pen sorted some way. */
export type PanelContext = { kind: 'overview'; group: GroupMode } | { kind: 'pen'; sort: SortMode };

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** UI pixels between the panel and the tank's edge by default. */
export const SPOT_MARGIN = 4;

/** Where the panel goes until it's moved: top-left on wide screens, bottom-left (near the thumb) on narrow ones. */
export function defaultSpot(narrow: boolean): PanelSpot {
  return { corner: narrow ? 'bl' : 'tl', x: SPOT_MARGIN, y: SPOT_MARGIN };
}

/** The saved keys for a context, from the most general to the most specific. */
export function spotPath(narrow: boolean, context: PanelContext): string[] {
  const root = narrow ? 'narrow' : 'wide';
  return context.kind === 'overview'
    ? [root, `${root}/group:${context.group}`]
    : [root, `${root}/pen`, `${root}/pen/sort:${context.sort}`];
}

const CORNERS = ['tl', 'tr', 'bl', 'br'] as const;

/** A saved spot as read back from storage, or undefined if it isn't one. */
export function validSpot(value: unknown): PanelSpot | undefined {
  const v = value as Partial<PanelSpot> | undefined;
  return v &&
    CORNERS.includes(v.corner as PanelSpot['corner']) &&
    Number.isInteger(v.x) &&
    Number.isInteger(v.y) &&
    (v.x ?? -1) >= 0 &&
    (v.y ?? -1) >= 0
    ? { corner: v.corner as PanelSpot['corner'], x: v.x as number, y: v.y as number }
    : undefined;
}

/** The spot for a path: its most specific saved level, else the default. */
export function resolveSpot(
  spots: Readonly<Record<string, unknown>> | undefined,
  path: readonly string[],
  narrow: boolean,
): PanelSpot {
  for (let i = path.length - 1; i >= 0; i--) {
    const spot = validSpot(spots?.[path[i] ?? '']);
    if (spot) return spot;
  }
  return defaultSpot(narrow);
}

/**
 * The panel's top-left corner for a spot, in whole UI pixels, kept inside
 * `box` (the tank). A panel bigger than the tank keeps its top-left in view.
 */
export function placeSpot(
  spot: PanelSpot,
  box: Box,
  panel: { w: number; h: number },
): { left: number; top: number } {
  const right = spot.corner === 'tr' || spot.corner === 'br';
  const bottom = spot.corner === 'bl' || spot.corner === 'br';
  const left = right ? box.x + box.w - spot.x - panel.w : box.x + spot.x;
  const top = bottom ? box.y + box.h - spot.y - panel.h : box.y + spot.y;
  return clampInto(left, top, box, panel);
}

/** A top-left position pulled inside `box`, in whole UI pixels. */
export function clampInto(
  left: number,
  top: number,
  box: Box,
  panel: { w: number; h: number },
): { left: number; top: number } {
  const fit = (v: number, min: number, room: number) =>
    Math.round(Math.max(min, Math.min(min + Math.max(0, room), v)));
  return {
    left: fit(left, box.x, box.w - panel.w),
    top: fit(top, box.y, box.h - panel.h),
  };
}

/**
 * The spot for a panel placed at `left`, `top`: measured from the tank corner
 * it's nearest to, so it stays there when the tank grows or shrinks.
 */
export function spotAt(
  left: number,
  top: number,
  box: Box,
  panel: { w: number; h: number },
): PanelSpot {
  const p = clampInto(left, top, box, panel);
  const right = p.left + panel.w / 2 > box.x + box.w / 2;
  const bottom = p.top + panel.h / 2 > box.y + box.h / 2;
  const corner = `${bottom ? 'b' : 't'}${right ? 'r' : 'l'}` as PanelSpot['corner'];
  return {
    corner,
    x: Math.max(0, Math.round(right ? box.x + box.w - p.left - panel.w : p.left - box.x)),
    y: Math.max(0, Math.round(bottom ? box.y + box.h - p.top - panel.h : p.top - box.y)),
  };
}

/** Saved spots with the panel moved here: this level and every level above it. */
export function withSpot(
  spots: Readonly<Record<string, PanelSpot>> | undefined,
  path: readonly string[],
  spot: PanelSpot,
): Record<string, PanelSpot> {
  return { ...spots, ...Object.fromEntries(path.map((key) => [key, spot])) };
}
