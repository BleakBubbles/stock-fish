/**
 * Currency conversion for totals. Pure: rates come in as a table, nothing is
 * fetched here (see refresh.ts and the providers' getExchangeRate).
 *
 * Fish show their own stock's currency. Only combined numbers (weather, group
 * summaries, territory sizes) are converted, into one home currency, at the
 * latest rate. "Today's change" is the stock's own move converted at that
 * rate; the exchange rate's own move today is not included (a price board
 * shows the stock, and the fish's mood is about the stock).
 */

/** Exchange rates by pair: 'USD/CAD' → CAD per USD. */
export type RateTable = ReadonlyMap<string, number>;

export const pairKey = (from: string, to: string) => `${from}/${to}`;

/**
 * Prices quoted in a currency's minor unit (pence, cents) as the major one:
 * GBp 1250 means £12.50.
 */
const MINOR_UNITS: Record<string, { code: string; factor: number }> = {
  GBp: { code: 'GBP', factor: 0.01 },
  GBX: { code: 'GBP', factor: 0.01 },
  ZAc: { code: 'ZAR', factor: 0.01 },
  ZAC: { code: 'ZAR', factor: 0.01 },
  ILA: { code: 'ILS', factor: 0.01 },
};

/** A quote currency as an ISO code plus a factor to apply to its prices. */
export function normalizeCurrency(currency: string): { code: string; factor: number } {
  const minor = MINOR_UNITS[currency];
  if (minor) return minor;
  return { code: currency.toUpperCase(), factor: 1 };
}

/**
 * Units of `to` per unit of `from`: direct, inverted, or crossed through USD.
 * Undefined if the table can't say.
 */
export function rateBetween(from: string, to: string, rates: RateTable): number | undefined {
  if (from === to) return 1;
  const direct = rates.get(pairKey(from, to));
  if (direct) return direct;
  const inverse = rates.get(pairKey(to, from));
  if (inverse) return 1 / inverse;
  if (from !== 'USD' && to !== 'USD') {
    const a = rateBetween(from, 'USD', rates);
    const b = rateBetween('USD', to, rates);
    if (a !== undefined && b !== undefined) return a * b;
  }
  return undefined;
}

/**
 * Multiply an amount in `currency` (a quote currency, possibly a minor unit)
 * by this to get home currency. Undefined while the rate is unknown; a quote
 * without a currency is taken to be in the home currency.
 */
export function homeFactor(
  currency: string | undefined,
  home: string,
  rates: RateTable,
): number | undefined {
  if (!currency) return 1;
  const { code, factor } = normalizeCurrency(currency);
  const rate = rateBetween(code, home, rates);
  return rate === undefined ? undefined : rate * factor;
}

/**
 * The automatic home currency: the one most of the portfolio's value is in.
 * Values are compared unconverted (rates may not be known yet), which is close
 * enough to pick a sensible default. USD when there's nothing to go on.
 */
export function autoHomeCurrency(
  positions: readonly { currency?: string; value: number }[],
): string {
  const totals = new Map<string, number>();
  for (const p of positions) {
    if (!p.currency || !(p.value > 0)) continue;
    const { code, factor } = normalizeCurrency(p.currency);
    totals.set(code, (totals.get(code) ?? 0) + p.value * factor);
  }
  let best = 'USD';
  let most = 0;
  for (const [code, total] of totals) {
    if (total > most) {
      best = code;
      most = total;
    }
  }
  return best;
}

/** The exchange rates needed to bring these quote currencies into `home`. */
export function pairsNeeded(currencies: readonly string[], home: string): string[] {
  const codes = new Set(currencies.map((c) => normalizeCurrency(c).code));
  codes.delete(home);
  return [...codes].sort().map((c) => pairKey(c, home));
}
