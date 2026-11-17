/**
 * US market clock (NYSE/Nasdaq, also TSX: 9:30–16:00 New York time,
 * weekdays). Exchange holidays aren't listed; the provider's own "market is
 * open" flag covers them (see marketOpenNow). Pure functions of a timestamp.
 */

const ZONE = 'America/New_York';
const OPEN_MINUTE = 9 * 60 + 30;
const CLOSE_MINUTE = 16 * 60;
/** Minutes after the close before the closing price counts as final. */
export const SETTLE_MINUTES = 20;

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
});

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface ZonedTime {
  /** YYYY-MM-DD in New York. */
  date: string;
  /** 0 = Sunday. */
  weekday: number;
  /** Minutes since midnight in New York. */
  minute: number;
  /** New York wall-clock time encoded as if it were UTC, for offset maths. */
  wallMs: number;
}

export function newYorkTime(ms: number): ZonedTime {
  const parts = Object.fromEntries(formatter.formatToParts(ms).map((p) => [p.type, p.value]));
  const [y, mo, d, h, mi, s] = ['year', 'month', 'day', 'hour', 'minute', 'second'].map((k) =>
    Number(parts[k]),
  ) as [number, number, number, number, number, number];
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAYS[parts.weekday ?? ''] ?? 0,
    minute: h * 60 + mi,
    wallMs: Date.UTC(y, mo - 1, d, h, mi, s),
  };
}

/** The instant a New York wall-clock time happens. */
function fromNewYork(date: string, minute: number): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const wall = Date.UTC(y, m - 1, d, Math.floor(minute / 60), minute % 60);
  // Offset is −4 or −5 h; measure it near the target to handle DST.
  const offset = newYorkTime(wall).wallMs - wall;
  return wall - offset;
}

/** True during a regular weekday session (holidays not included). */
export function isRegularSession(ms: number): boolean {
  const t = newYorkTime(ms);
  return t.weekday >= 1 && t.weekday <= 5 && t.minute >= OPEN_MINUTE && t.minute < CLOSE_MINUTE;
}

/**
 * The most recent weekday close plus SETTLE_MINUTES at or before `ms`: after
 * this instant that day's closing prices and daily bar are final.
 */
export function lastSettledClose(ms: number): number {
  const settle = CLOSE_MINUTE + SETTLE_MINUTES;
  let probe = ms;
  for (let i = 0; i < 8; i++) {
    const t = newYorkTime(probe);
    if (t.weekday >= 1 && t.weekday <= 5) {
      const candidate = fromNewYork(t.date, settle);
      if (candidate <= ms) return candidate;
    }
    probe -= 86_400_000;
  }
  throw new Error('No weekday in the last 8 days');
}

/**
 * Is the market open now? The clock decides, except that fresh quotes saying
 * "closed" during session hours (an exchange holiday) win.
 */
export function marketOpenNow(
  ms: number,
  recentQuotes: readonly { marketOpen?: boolean; fetchedAt: number }[] = [],
): boolean {
  if (!isRegularSession(ms)) return false;
  const today = newYorkTime(ms).date;
  const fromToday = recentQuotes.filter(
    (q) => q.marketOpen !== undefined && newYorkTime(q.fetchedAt).date === today,
  );
  if (fromToday.length > 0 && fromToday.every((q) => q.marketOpen === false)) return false;
  return true;
}
