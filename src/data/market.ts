/**
 * Market clocks, one per exchange: each fish sleeps on its own market's hours
 * (docs/SPEC.md, "Market closed"). Stock markets keep regular weekday
 * sessions; exchange holidays aren't listed, the provider's own "market is
 * open" flag covers them (see marketOpenNow). Lunch breaks (Tokyo, Hong Kong,
 * Shanghai) count as open. Crypto never closes (its days are UTC days), and
 * currency pairs trade from Sunday to Friday, 17:00 New York time. Pure
 * functions of a timestamp.
 */

export interface Exchange {
  /** Market identifier code (ISO 10383) of the main market, e.g. XNYS. */
  id: string;
  /** Short name for messages ("London closed"). */
  name: string;
  /** IANA time zone the session hours are in. */
  zone: string;
  /** Session open and close, minutes after local midnight. */
  open: number;
  close: number;
  /**
   * Which days it trades: weekday sessions (stock markets), every minute of
   * every day (crypto), or from Sunday's open to Friday's close (currencies).
   */
  days: 'weekdays' | 'always' | 'forex';
}

const hm = (h: number, m = 0) => h * 60 + m;
const ex = (id: string, name: string, zone: string, open: number, close: number): Exchange => ({
  id,
  name,
  zone,
  open,
  close,
  days: 'weekdays',
});

/** Crypto: never closes; each day runs from midnight UTC, as the provider's daily bars do. */
export const CRYPTO: Exchange = {
  id: 'CRYPTO',
  name: 'Crypto',
  zone: 'UTC',
  open: 0,
  close: 24 * 60,
  days: 'always',
};

/** Currency pairs: Sunday 17:00 to Friday 17:00 New York time, each day ending at 17:00. */
export const FOREX: Exchange = {
  id: 'FOREX',
  name: 'Forex',
  zone: 'America/New_York',
  open: 17 * 60,
  close: 17 * 60,
  days: 'forex',
};

/** Common currencies (and metals quoted like them): a pair of two of these is forex, not crypto. */
const FIAT = new Set(
  (
    'USD EUR JPY GBP CHF CAD AUD NZD CNY CNH HKD SGD SEK NOK DKK PLN CZK HUF TRY ZAR MXN BRL ' +
    'INR KRW TWD THB IDR MYR PHP ILS AED SAR RUB XAU XAG'
  ).split(' '),
);

/** NYSE, Nasdaq and the other US venues (also the fallback for unknown markets). */
export const US = ex('XNYS', 'US', 'America/New_York', hm(9, 30), hm(16));

const TORONTO = ex('XTSE', 'Toronto', 'America/Toronto', hm(9, 30), hm(16));
const LONDON = ex('XLON', 'London', 'Europe/London', hm(8), hm(16, 30));
const XETRA = ex('XETR', 'Xetra', 'Europe/Berlin', hm(9), hm(17, 30));
// Paris, Amsterdam, Brussels, Lisbon and Dublin share one session in Paris time.
const EURONEXT = ex('XPAR', 'Euronext', 'Europe/Paris', hm(9), hm(17, 30));
const TOKYO = ex('XTKS', 'Tokyo', 'Asia/Tokyo', hm(9), hm(15, 30));
const HONG_KONG = ex('XHKG', 'Hong Kong', 'Asia/Hong_Kong', hm(9, 30), hm(16));
const SYDNEY = ex('XASX', 'Sydney', 'Australia/Sydney', hm(10), hm(16));
const INDIA = ex('XNSE', 'India', 'Asia/Kolkata', hm(9, 15), hm(15, 30));

/** By market identifier code (Twelve Data's `mic_code`). */
const BY_MIC: Record<string, Exchange> = {
  // United States: exchanges and OTC venues.
  ...Object.fromEntries(
    ['XNYS', 'XNAS', 'XNGS', 'XNMS', 'XNCM', 'XASE', 'ARCX', 'BATS', 'XCBO', 'OTCM', 'PINX'].map(
      (mic) => [mic, US],
    ),
  ),
  ...Object.fromEntries(['XTSE', 'XTSX', 'XCNQ', 'NEOE'].map((mic) => [mic, TORONTO])),
  XLON: LONDON,
  XETR: XETRA,
  XFRA: XETRA,
  ...Object.fromEntries(['XPAR', 'XAMS', 'XBRU', 'XLIS', 'XMSM'].map((mic) => [mic, EURONEXT])),
  XMIL: ex('XMIL', 'Milan', 'Europe/Rome', hm(9), hm(17, 30)),
  XMAD: ex('XMAD', 'Madrid', 'Europe/Madrid', hm(9), hm(17, 30)),
  XSWX: ex('XSWX', 'Zurich', 'Europe/Zurich', hm(9), hm(17, 30)),
  XSTO: ex('XSTO', 'Stockholm', 'Europe/Stockholm', hm(9), hm(17, 30)),
  XCSE: ex('XCSE', 'Copenhagen', 'Europe/Copenhagen', hm(9), hm(17)),
  XHEL: ex('XHEL', 'Helsinki', 'Europe/Helsinki', hm(10), hm(18, 30)),
  XOSL: ex('XOSL', 'Oslo', 'Europe/Oslo', hm(9), hm(16, 20)),
  XTKS: TOKYO,
  XHKG: HONG_KONG,
  XSHG: ex('XSHG', 'Shanghai', 'Asia/Shanghai', hm(9, 30), hm(15)),
  XSHE: ex('XSHE', 'Shenzhen', 'Asia/Shanghai', hm(9, 30), hm(15)),
  XKRX: ex('XKRX', 'Seoul', 'Asia/Seoul', hm(9), hm(15, 30)),
  XTAI: ex('XTAI', 'Taipei', 'Asia/Taipei', hm(9), hm(13, 30)),
  XSES: ex('XSES', 'Singapore', 'Asia/Singapore', hm(9), hm(17)),
  XASX: SYDNEY,
  XNZE: ex('XNZE', 'Auckland', 'Pacific/Auckland', hm(10), hm(16, 45)),
  XNSE: INDIA,
  XBOM: INDIA,
  XJSE: ex('XJSE', 'Johannesburg', 'Africa/Johannesburg', hm(9), hm(17)),
  XMEX: ex('XMEX', 'Mexico', 'America/Mexico_City', hm(8, 30), hm(15)),
  BVMF: ex('BVMF', 'B3', 'America/Sao_Paulo', hm(10), hm(17)),
};

/**
 * By exchange name, as Twelve Data spells it in a quote's `exchange` or after
 * a colon in a symbol (RY:TSX), plus common Yahoo-style suffixes (RY.TO).
 */
const BY_NAME: Record<string, Exchange> = {
  NASDAQ: US,
  NYSE: US,
  AMEX: US,
  'NYSE ARCA': US,
  ARCA: US,
  CBOE: US,
  OTC: US,
  TSX: TORONTO,
  TSXV: TORONTO,
  NEO: TORONTO,
  TO: TORONTO,
  V: TORONTO,
  LSE: LONDON,
  L: LONDON,
  XETR: XETRA,
  FSX: XETRA,
  DE: XETRA,
  EURONEXT: EURONEXT,
  PA: EURONEXT,
  AS: EURONEXT,
  BR: EURONEXT,
  SIX: BY_MIC.XSWX as Exchange,
  SW: BY_MIC.XSWX as Exchange,
  JPX: TOKYO,
  TSE: TOKYO,
  T: TOKYO,
  HKEX: HONG_KONG,
  HK: HONG_KONG,
  ASX: SYDNEY,
  AX: SYDNEY,
  NSE: INDIA,
  BSE: INDIA,
  NS: INDIA,
  BO: INDIA,
};

/**
 * Which market a symbol trades on. A pair (BTC/USD) is crypto, or forex if
 * both sides are currencies (EUR/USD). Otherwise the quote's market
 * identifier code, else its exchange name, else the symbol's own suffix
 * (RY:TSX, RY.TO), else US: unknown markets keep US hours.
 */
export function exchangeFor(symbol: string, quote?: { mic?: string; exchange?: string }): Exchange {
  const pair = /^([A-Z0-9]+)\/([A-Z0-9]+)$/.exec(symbol.toUpperCase());
  if (pair) return FIAT.has(pair[1] ?? '') && FIAT.has(pair[2] ?? '') ? FOREX : CRYPTO;
  const byMic = quote?.mic ? BY_MIC[quote.mic.toUpperCase()] : undefined;
  if (byMic) return byMic;
  const byName = quote?.exchange ? BY_NAME[quote.exchange.toUpperCase()] : undefined;
  if (byName) return byName;
  const suffix = /[:.]([A-Z]+)$/.exec(symbol.toUpperCase())?.[1];
  return (suffix && BY_NAME[suffix]) || US;
}

/** Minutes after the close before the closing price counts as final. */
export const SETTLE_MINUTES = 20;

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    formatters.set(zone, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface ZonedTime {
  /** YYYY-MM-DD in the zone. */
  date: string;
  /** 0 = Sunday. */
  weekday: number;
  /** Minutes since midnight in the zone. */
  minute: number;
  /** Wall-clock time encoded as if it were UTC, for offset maths. */
  wallMs: number;
}

export function zonedTime(ms: number, zone: string): ZonedTime {
  const parts = Object.fromEntries(
    formatterFor(zone)
      .formatToParts(ms)
      .map((p) => [p.type, p.value]),
  );
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

export function newYorkTime(ms: number): ZonedTime {
  return zonedTime(ms, US.zone);
}

/** The instant a wall-clock time happens in a zone. */
function fromZone(date: string, minute: number, zone: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const wall = Date.UTC(y, m - 1, d, Math.floor(minute / 60), minute % 60);
  // Measure the zone's offset near the target, to handle DST.
  const offset = zonedTime(wall, zone).wallMs - wall;
  return wall - offset;
}

const isWeekday = (t: ZonedTime) => t.weekday >= 1 && t.weekday <= 5;

const DAY_MS = 86_400_000;

/** True during a regular session (holidays not included). */
export function isRegularSession(ms: number, exchange: Exchange = US): boolean {
  if (exchange.days === 'always') return true;
  const t = zonedTime(ms, exchange.zone);
  if (exchange.days === 'forex') {
    // Closed from Friday's close to Sunday's open.
    if (t.weekday === 6) return false;
    if (t.weekday === 5) return t.minute < exchange.close;
    if (t.weekday === 0) return t.minute >= exchange.open;
    return true;
  }
  return isWeekday(t) && t.minute >= exchange.open && t.minute < exchange.close;
}

/**
 * The most recent weekday close plus SETTLE_MINUTES at or before `ms`: after
 * this instant that day's closing prices and daily bar are final.
 */
export function lastSettledClose(ms: number, exchange: Exchange = US): number {
  if (exchange.days === 'always') {
    // Each day closes at midnight (in its zone).
    const today = fromZone(zonedTime(ms, exchange.zone).date, SETTLE_MINUTES, exchange.zone);
    return today <= ms
      ? today
      : fromZone(zonedTime(ms - DAY_MS, exchange.zone).date, SETTLE_MINUTES, exchange.zone);
  }
  // Weekday closes (for currencies, each trading day ends at 17:00 New York, Monday to Friday).
  const settle = exchange.close + SETTLE_MINUTES;
  let probe = ms;
  for (let i = 0; i < 8; i++) {
    const t = zonedTime(probe, exchange.zone);
    if (isWeekday(t)) {
      const candidate = fromZone(t.date, settle, exchange.zone);
      if (candidate <= ms) return candidate;
    }
    probe -= DAY_MS;
  }
  throw new Error('No weekday in the last 8 days');
}

/**
 * Is this market open now? The clock decides, except that fresh quotes from
 * it saying "closed" during session hours (an exchange holiday) win.
 */
export function marketOpenNow(
  ms: number,
  recentQuotes: readonly { marketOpen?: boolean; fetchedAt: number }[] = [],
  exchange: Exchange = US,
): boolean {
  if (!isRegularSession(ms, exchange)) return false;
  const today = zonedTime(ms, exchange.zone).date;
  const fromToday = recentQuotes.filter(
    (q) => q.marketOpen !== undefined && zonedTime(q.fetchedAt, exchange.zone).date === today,
  );
  if (fromToday.length > 0 && fromToday.every((q) => q.marketOpen === false)) return false;
  return true;
}

export interface MarketState {
  exchange: Exchange;
  open: boolean;
}

/** What marketStates needs from a cached entry. */
interface CachedQuote {
  quote?: { mic?: string; exchange?: string; marketOpen?: boolean };
  quoteAt?: number;
}

/**
 * Each symbol's market and whether it's open now. Quotes from the same market
 * vote together on holidays.
 */
export function marketStates(
  ms: number,
  symbols: Iterable<string>,
  entries: ReadonlyMap<string, CachedQuote>,
): Map<string, MarketState> {
  const exchangeOf = new Map<string, Exchange>();
  const recent = new Map<string, { marketOpen?: boolean; fetchedAt: number }[]>();
  for (const symbol of symbols) {
    if (exchangeOf.has(symbol)) continue;
    const entry = entries.get(symbol);
    const exchange = exchangeFor(symbol, entry?.quote);
    exchangeOf.set(symbol, exchange);
    const list = recent.get(exchange.id) ?? [];
    recent.set(exchange.id, list);
    if (entry?.quote && entry.quoteAt !== undefined) {
      list.push({ marketOpen: entry.quote.marketOpen, fetchedAt: entry.quoteAt });
    }
  }
  const open = new Map<string, boolean>();
  for (const exchange of new Set(exchangeOf.values())) {
    open.set(exchange.id, marketOpenNow(ms, recent.get(exchange.id), exchange));
  }
  return new Map(
    [...exchangeOf].map(([symbol, exchange]) => [
      symbol,
      { exchange, open: open.get(exchange.id) ?? false },
    ]),
  );
}

/**
 * What the tank says about closed markets, for the markets of the fish shown:
 * nothing while all are open; "Market closed" when every one is (there's only
 * one, or they all are); "London closed" when one of several is; otherwise
 * how many are.
 */
export function closedMarketsText(states: Iterable<MarketState>): string | undefined {
  const byId = new Map<string, MarketState>();
  for (const s of states) byId.set(s.exchange.id, s);
  const all = [...byId.values()];
  const closed = all.filter((s) => !s.open);
  if (closed.length === 0) return undefined;
  if (closed.length === all.length) return all.length === 1 ? 'Market closed' : 'Markets closed';
  if (closed.length === 1) return `${closed[0]?.exchange.name} closed`;
  return `${closed.length} markets closed`;
}
