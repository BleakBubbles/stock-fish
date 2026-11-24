/**
 * Bond (docs/SPEC.md, "Care and the daily visit"): each shark's bond is the
 * days it has been fed (once a day). Days fed, not a streak: a missed day
 * costs nothing. Bond never depends on returns. Pure.
 */
import type { Bond } from '../data/model';

/** Days fed at which each heart is earned (5 hearts in all). */
export const HEART_DAYS = [3, 10, 30, 60, 100] as const;
export const MAX_HEARTS = HEART_DAYS.length;
/** Then, just for fun, they turn gold one by one: all gold after a year. */
export const GOLD_DAYS = [150, 200, 250, 300, 365] as const;

/** Hearts earned after `days` days fed. */
export function hearts(days: number): number {
  return HEART_DAYS.filter((d) => days >= d).length;
}

/** Of those, how many have turned gold. */
export function goldHearts(days: number): number {
  return GOLD_DAYS.filter((d) => days >= d).length;
}

/** Whether the shark was visited (fed) on `day` ("YYYY-MM-DD"). */
export function visitedOn(bond: Bond | undefined, day: string): boolean {
  return bond?.lastVisit === day;
}

/** The bond after a visit on `day`: one more day, unless already visited that day. */
export function visit(bond: Bond | undefined, day: string): Bond {
  if (bond && visitedOn(bond, day)) return bond;
  return { days: (bond?.days ?? 0) + 1, lastVisit: day };
}

/** Two sharks merged into one (the same ticker moved into a pen): the stronger bond. */
export function mergeBonds(a: Bond | undefined, b: Bond | undefined): Bond | undefined {
  if (!a || !b) return a ?? b;
  const days = Math.max(a.days, b.days);
  const lastVisit = [a.lastVisit, b.lastVisit]
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);
  return lastVisit ? { days, lastVisit } : { days };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isValidBond(v: unknown): v is Bond {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const { days, lastVisit } = v as Record<string, unknown>;
  return (
    typeof days === 'number' &&
    Number.isInteger(days) &&
    days >= 0 &&
    (lastVisit === undefined || (typeof lastVisit === 'string' && DAY.test(lastVisit)))
  );
}
