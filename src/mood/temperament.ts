/**
 * Temperament: how restless a fish is, from how much its price usually moves.
 * 0 is calm (slow glides, long rests), 1 is jittery (quick short darts). It
 * depends on typical daily volatility σ only, never on today's move, so a
 * fish keeps its character from day to day (today's move is the mood's job).
 */

/** At or below this σ (0.5 % a day: bond funds, utilities) a fish is fully calm. */
export const SIGMA_CALM = 0.005;
/** At or above this σ (4 % a day: crypto, small caps) a fish is fully jittery. */
export const SIGMA_JITTERY = 0.04;
/** Without a known σ (short history), a fish swims in the middle way. */
export const DEFAULT_TEMPER = 0.5;

/**
 * Temperament from 0 to 1, on a log scale of σ between SIGMA_CALM and
 * SIGMA_JITTERY, so doubling the volatility always adds the same restlessness.
 * A broad index fund (σ ≈ 1 %) comes out at about 0.33, a big tech stock
 * (σ ≈ 2 to 3 %) at about 0.7 to 0.85.
 */
export function temperFor(sigma: number | undefined): number {
  if (sigma === undefined || !Number.isFinite(sigma) || sigma <= 0) return DEFAULT_TEMPER;
  const t = Math.log(sigma / SIGMA_CALM) / Math.log(SIGMA_JITTERY / SIGMA_CALM);
  return Math.min(1, Math.max(0, t));
}
