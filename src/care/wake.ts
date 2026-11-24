/**
 * The morning wake-up (docs/SPEC.md, "Care and the daily visit"): the first
 * time the tank is seen each day the sharks are dozing, and one tap wakes them
 * all, one after another. A shark whose
 * market is closed wakes drowsy, shows its mood for a moment, and dozes off
 * again (asleep still means "no fresh prices"). Pure: no React, no PixiJS.
 */

/** The local calendar day, "YYYY-MM-DD": the wake-up comes once per day. */
export function localDay(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/**
 * Whether the sharks are dozing, waiting to be woken: the wake-up is on (the
 * default) and they haven't been woken today. Unknown settings (still loading)
 * don't doze, so the tank never flashes asleep.
 */
export function dozing(
  settings: { wakeUp?: boolean; lastWoken?: string } | undefined,
  now: Date,
): boolean {
  if (!settings || settings.wakeUp === false) return false;
  return settings.lastWoken !== localDay(now);
}

/** Wake-up timing, in seconds. */
export const WAKE = {
  /** Sharks wake one after another, each within this long of the tap. */
  stagger: 0.8,
  /** How long a shark on a closed market shows its mood before dozing off again. */
  drowsy: 4,
} as const;

/** What a waking shark shows: still asleep, or its mood. */
export type WakeFace = 'sleeping' | 'mood';

/**
 * The face of a shark `t` seconds after the tap, waking `delay` seconds in.
 * Undefined once its wake-up is over (the usual rules apply again: asleep on
 * a closed market, its mood otherwise).
 */
export function wakeFace(t: number, delay: number, closed: boolean): WakeFace | undefined {
  if (t < delay) return 'sleeping';
  if (closed && t < delay + WAKE.drowsy) return 'mood';
  return undefined;
}

/** How long the whole wake-up lasts, after which no shark is still waking. */
export const WAKE_LENGTH = WAKE.stagger + WAKE.drowsy;
