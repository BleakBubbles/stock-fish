/**
 * The typical-day range bar in a fish's details: where today's move falls
 * against the holding's usual daily moves. Pure layout, in whole UI pixels.
 *
 * The bar spans ±Z_SPAN typical days (σ). A filled band marks the calm zone
 * (the mood tiers' neutral band), ticks mark where ecstatic and sad begin, and
 * a marker shows today. Past the ends, the marker stops at the edge.
 */
import { DEFAULT_THRESHOLDS, type TierThresholds } from '../mood/tiers';

/** The bar reaches this many typical days either side of zero. */
export const Z_SPAN = 3;

export interface RangeBarLayout {
  /** Total width (odd, so zero falls on a pixel). */
  width: number;
  /** The calm band: from x, w pixels wide. */
  band: { x: number; w: number };
  /** Left edges of the two strong-move ticks. */
  ticks: [number, number];
  /** Centre pixel of today's marker. */
  marker: number;
  /** −1 or 1 when today is past the bar's end (the marker sits at that edge), else 0. */
  beyond: -1 | 0 | 1;
}

/** Lay out the bar `width` UI pixels wide (rounded down to odd) for today's z. */
export function rangeBarLayout(
  z: number,
  width: number,
  thresholds: TierThresholds = DEFAULT_THRESHOLDS,
): RangeBarLayout {
  const w = Math.max(15, width % 2 === 0 ? width - 1 : width);
  const mid = (w - 1) / 2;
  const unit = mid / Z_SPAN;
  const at = (zz: number) => mid + Math.round(zz * unit);
  const bandFrom = at(-thresholds.mild);
  const bandTo = at(thresholds.mild);
  const safeZ = Number.isFinite(z) ? z : 0;
  const beyond = safeZ > Z_SPAN ? 1 : safeZ < -Z_SPAN ? -1 : 0;
  const clamped = Math.max(-Z_SPAN, Math.min(Z_SPAN, safeZ));
  // Keep the marker's 3-pixel body inside the bar.
  const marker = Math.max(1, Math.min(w - 2, at(clamped)));
  return {
    width: w,
    band: { x: bandFrom, w: bandTo - bandFrom + 1 },
    ticks: [at(-thresholds.strong), at(thresholds.strong)],
    marker,
    beyond,
  };
}
