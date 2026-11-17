import { simpleReturn } from './stats';
import type { Mood } from './types';
import { type Bar, typicalVolatility } from './volatility';

/**
 * Tier edges in units of typical daily volatility (σ). Symmetric, with a
 * wide neutral band so most days most fish look calm. A starting proposal
 * (docs/SPEC.md) to tune with real data.
 *
 *   z > +2           ecstatic
 *   +0.5 ≤ z ≤ +2    happy
 *   −0.5 < z < +0.5  neutral
 *   −2 ≤ z ≤ −0.5    uneasy
 *   z < −2           sad
 */
export interface TierThresholds {
  /** |z| at or above this leaves neutral. */
  mild: number;
  /** |z| strictly above this is ecstatic or sad. */
  strong: number;
}

export const DEFAULT_THRESHOLDS: TierThresholds = { mild: 0.5, strong: 2 };

/**
 * σ below this (0.01 % a day) is treated as no volatility at all: dividing by
 * it would turn rounding noise into ecstasy (money-market funds, stale data).
 */
export const MIN_SIGMA = 1e-4;

export function tierFor(z: number, thresholds: TierThresholds = DEFAULT_THRESHOLDS): Mood {
  if (!Number.isFinite(z)) return 'neutral';
  if (z > thresholds.strong) return 'ecstatic';
  if (z >= thresholds.mild) return 'happy';
  if (z > -thresholds.mild) return 'neutral';
  if (z >= -thresholds.strong) return 'uneasy';
  return 'sad';
}

export interface MoodInput {
  /** Latest price. */
  price: number;
  /** Close of the previous trading day. */
  previousClose: number;
  /** Daily closes, any order; today's unfinished bar is dropped via `asOf`. */
  history: readonly Bar[];
  /** Trading day of `price` (YYYY-MM-DD). Bars on or after it are ignored for σ. */
  asOf?: string;
}

export type MoodReason =
  /** Mood comes from today's move against σ. */
  | 'ok'
  /** Fewer than MIN_RETURNS days of history: neutral. */
  | 'short-history'
  /** History is (almost) perfectly flat: neutral. */
  | 'flat-history'
  /** Price or previous close unusable: neutral. */
  | 'bad-quote';

export interface MoodResult {
  mood: Mood;
  reason: MoodReason;
  /** Today's simple return, e.g. −0.012 for −1.2 %. NaN if the quote was unusable. */
  todayReturn: number;
  /** Typical daily volatility, when known. */
  sigma?: number;
  /** todayReturn ÷ sigma, when both are known. */
  z?: number;
}

/** Today's mood for one holding: today's return scaled by its typical daily volatility. */
export function assessMood(
  input: MoodInput,
  thresholds: TierThresholds = DEFAULT_THRESHOLDS,
): MoodResult {
  const todayReturn = simpleReturn(input.previousClose, input.price);
  if (!Number.isFinite(todayReturn)) return { mood: 'neutral', reason: 'bad-quote', todayReturn };

  const sigma = typicalVolatility(input.history, input.asOf);
  if (sigma === undefined) return { mood: 'neutral', reason: 'short-history', todayReturn };
  if (sigma < MIN_SIGMA) return { mood: 'neutral', reason: 'flat-history', todayReturn, sigma };

  const z = todayReturn / sigma;
  return { mood: tierFor(z, thresholds), reason: 'ok', todayReturn, sigma, z };
}
