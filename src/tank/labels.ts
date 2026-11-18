/**
 * Where fish labels go when fish crowd together: each label starts at its home
 * spot (text under the fish, badge above it) and, if that spot is taken by a
 * label of a fish further forward, moves to the nearest free spot. Pure, in
 * art pixels.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A shift from a label's home spot, in whole art pixels. */
export type Nudge = readonly [dx: number, dy: number];

export interface LabelHome {
  /** The fish's id. */
  id: string;
  /** Home spots, each with the way it prefers to move: +1 down (text), −1 up (badge). */
  boxes: readonly { box: Box; away: 1 | -1 }[];
}

/** How far a label may move from home before it gives up and overlaps. */
export const NUDGE_MAX = 12;
const NUDGE_STEP = 2;

const STAY: Nudge = [0, 0];

/** Shifts to try, nearest first: away from the fish, then sideways, then towards it. */
function candidates(away: 1 | -1): Nudge[] {
  const out: Nudge[] = [];
  for (let d = NUDGE_STEP; d <= NUDGE_MAX; d += NUDGE_STEP) {
    out.push([0, away * d], [-d, 0], [d, 0], [-d, away * d], [d, away * d]);
  }
  for (let d = NUDGE_STEP; d <= NUDGE_MAX; d += NUDGE_STEP) {
    out.push([0, -away * d], [-d, -away * d], [d, -away * d]);
  }
  return out;
}
const CANDIDATES = { 1: candidates(1), [-1]: candidates(-1) } as const;

function clampInto(box: Box, area: Box): Box {
  return {
    ...box,
    x: Math.min(area.x + area.w - box.w, Math.max(area.x, box.x)),
    y: Math.min(area.y + area.h - box.h, Math.max(area.y, box.y)),
  };
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Place every fish's labels, front fish first (so the fish on top keeps its
 * labels at home). A label tries home, then the shift it had last time (so it
 * doesn't hop about as fish swim), then the nearest free shift. With nowhere
 * free nearby, it is hidden (undefined): a jumble of overlapping labels says
 * nothing, and the fish in front, or the one selected, keeps its own.
 * Returns the final boxes, inside `area`, and the shifts to remember.
 */
export function placeLabels(
  frontToBack: readonly LabelHome[],
  area: Box,
  previous: ReadonlyMap<string, readonly Nudge[]> = new Map(),
): Map<string, { boxes: (Box | undefined)[]; nudges: Nudge[] }> {
  const taken: Box[] = [];
  const result = new Map<string, { boxes: (Box | undefined)[]; nudges: Nudge[] }>();
  for (const { id, boxes } of frontToBack) {
    const placed: (Box | undefined)[] = [];
    const nudges: Nudge[] = [];
    boxes.forEach(({ box, away }, i) => {
      const at = ([dx, dy]: Nudge) => clampInto({ ...box, x: box.x + dx, y: box.y + dy }, area);
      const free = (b: Box) => !taken.some((t) => overlaps(t, b));
      const last = previous.get(id)?.[i];
      const tries = [STAY, ...(last ? [last] : []), ...CANDIDATES[away]];
      const nudge = tries.find((n) => free(at(n)));
      const final = nudge && at(nudge);
      if (final) taken.push(final);
      placed.push(final);
      nudges.push(nudge ?? STAY);
    });
    result.set(id, { boxes: placed, nudges });
  }
  return result;
}
