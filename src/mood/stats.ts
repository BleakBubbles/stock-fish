/** Small numeric helpers for the mood engine. Pure, no dependencies. */

export function mean(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Sample standard deviation (n − 1). NaN for fewer than two values. */
export function sampleStdDev(values: readonly number[]): number {
  if (values.length < 2) return NaN;
  const m = mean(values);
  let squares = 0;
  for (const v of values) squares += (v - m) ** 2;
  return Math.sqrt(squares / (values.length - 1));
}

/** Simple return from one price to the next: 0.02 means +2 %. NaN if either price is unusable. */
export function simpleReturn(from: number, to: number): number {
  if (!(from > 0) || !Number.isFinite(from) || !(to >= 0) || !Number.isFinite(to)) return NaN;
  return to / from - 1;
}

/** Day-to-day simple returns of a close series (one fewer than the closes). */
export function dailyReturns(closes: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    out.push(simpleReturn(closes[i - 1] as number, closes[i] as number));
  }
  return out;
}
