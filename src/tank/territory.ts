/**
 * Territory: each fish claims a patch of the tank sized by its share of the
 * value, like a treemap (docs/SPEC.md, "Organizing fish"). Pure and in whole
 * art pixels.
 *
 * The treemap keeps the input order (an ordered binary split), so when
 * weights drift the patches shift a little instead of reshuffling. Items too
 * small for a patch of their own share one communal patch at the end.
 */

/** A rectangle in whole art pixels. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Weighted {
  id: string;
  weight: number;
}

export interface Patch {
  /** One id, or several for the communal patch. */
  ids: string[];
  rect: Rect;
  communal: boolean;
}

/** Shape of one fish, used to cut patches that suit a wide fish. */
export interface Aspect {
  w: number;
  h: number;
}

/**
 * Cut `rect` into one rectangle per weight, in order. Each cut splits the list
 * where the two halves' weights are closest, across the rectangle's longer
 * side (measured in fish, so patches suit wide fish). Cuts round to whole
 * pixels. Where there's room, no piece is cut thinner than `min` (a patch a
 * fish can swim in), even if that gives a small item more than its share.
 */
export function orderedTreemap(
  weights: readonly number[],
  rect: Rect,
  aspect: Aspect,
  min: Aspect = { w: 1, h: 1 },
): Rect[] {
  if (weights.length === 0) return [];
  if (weights.length === 1) return [rect];
  const total = weights.reduce((a, b) => a + b, 0);
  let k = 1;
  let best = Infinity;
  let running = 0;
  for (let i = 1; i < weights.length; i++) {
    running += weights[i - 1] ?? 0;
    const diff = Math.abs(total / 2 - running);
    if (diff < best) {
      best = diff;
      k = i;
    }
  }
  const leftWeight = weights.slice(0, k).reduce((a, b) => a + b, 0);
  const share = total > 0 ? leftWeight / total : k / weights.length;
  const across = rect.w / aspect.w >= rect.h / aspect.h;
  const length = across ? rect.w : rect.h;
  const minLength = across ? min.w : min.h;
  const floor = length >= 2 * minLength ? minLength : 1;
  const cut = Math.min(length - floor, Math.max(floor, Math.round(length * share)));
  const [a, b]: [Rect, Rect] = across
    ? [
        { x: rect.x, y: rect.y, w: cut, h: rect.h },
        { x: rect.x + cut, y: rect.y, w: rect.w - cut, h: rect.h },
      ]
    : [
        { x: rect.x, y: rect.y, w: rect.w, h: cut },
        { x: rect.x, y: rect.y + cut, w: rect.w, h: rect.h - cut },
      ];
  return [
    ...orderedTreemap(weights.slice(0, k), a, aspect, min),
    ...orderedTreemap(weights.slice(k), b, aspect, min),
  ];
}

/**
 * Patches for `items` (in order) inside `rect`. Any item whose share of the
 * area would fall below `minArea` joins the communal patch, which is itself
 * given at least `minArea`. Zero or unknown total weight means equal shares.
 */
export function layoutTerritory(
  items: readonly Weighted[],
  rect: Rect,
  minArea: number,
  aspect: Aspect,
  min?: Aspect,
): Patch[] {
  if (items.length === 0) return [];
  const total = items.reduce((a, i) => a + Math.max(0, i.weight), 0);
  const weightOf = (i: Weighted) => (total > 0 ? Math.max(0, i.weight) : 1);
  const minShare = Math.min(1, minArea / (rect.w * rect.h));

  const small = new Set<string>();
  for (;;) {
    const big = items.filter((i) => !small.has(i.id));
    const bigWeight = big.reduce((a, i) => a + weightOf(i), 0);
    const smallWeight = items.reduce((a, i) => a + (small.has(i.id) ? weightOf(i) : 0), 0);
    // With a communal patch, the shares are of bigWeight + its (inflated) weight.
    let whole = bigWeight + smallWeight;
    if (small.size > 0 && smallWeight < minShare * whole) {
      whole = minShare < 1 ? bigWeight / (1 - minShare) : Infinity;
    }
    const tooSmall = big.filter((i) => weightOf(i) < minShare * whole);
    if (tooSmall.length === 0) break;
    for (const i of tooSmall) small.add(i.id);
  }

  const big = items.filter((i) => !small.has(i.id));
  const bigWeight = big.reduce((a, i) => a + weightOf(i), 0);
  const smallIds = items.filter((i) => small.has(i.id)).map((i) => i.id);
  const smallWeight = items.reduce((a, i) => a + (small.has(i.id) ? weightOf(i) : 0), 0);
  const communalWeight =
    smallIds.length === 0
      ? 0
      : big.length === 0
        ? 1
        : Math.max(smallWeight, (minShare * bigWeight) / (1 - minShare));

  const groups = [
    ...big.map((i) => ({ ids: [i.id], weight: weightOf(i), communal: false })),
    ...(smallIds.length > 0
      ? [{ ids: smallIds, weight: communalWeight, communal: smallIds.length > 1 }]
      : []),
  ];
  const rects = orderedTreemap(
    groups.map((g) => g.weight),
    rect,
    aspect,
    min,
  );
  return groups.map((g, i) => ({ ids: g.ids, communal: g.communal, rect: rects[i] ?? rect }));
}

/**
 * The user's order for a pen: ids in `layout` first (skipping any that left),
 * then the rest in their given order.
 */
export function applyLayout(
  ids: readonly string[],
  layout: readonly string[] | undefined,
): string[] {
  if (!layout?.length) return [...ids];
  const present = new Set(ids);
  const first = layout.filter((id) => present.has(id));
  const placed = new Set(first);
  return [...first, ...ids.filter((id) => !placed.has(id))];
}

/** Move `id` to the slot `targetId` occupies (before it when moving up, after when moving down). */
export function reorder(order: readonly string[], id: string, targetId: string): string[] {
  const from = order.indexOf(id);
  const to = order.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return [...order];
  const next = order.filter((x) => x !== id);
  next.splice(to, 0, id);
  return next;
}
