/** Number formatting for prices and changes. Signs are always shown on changes. */

const percent = new Intl.NumberFormat(undefined, {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

/** 0.0123 → "+1.23%". */
export function formatChangeRatio(ratio: number): string {
  return Number.isFinite(ratio) ? percent.format(ratio) : '–';
}

/**
 * Money with a currency symbol when the currency is known, else a plain
 * number. `signed` adds + to gains (for changes).
 */
export function formatMoney(value: number, currency?: string, signed = false): string {
  if (!Number.isFinite(value)) return '–';
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: signed ? 'exceptZero' : 'auto',
  };
  try {
    if (currency) {
      return new Intl.NumberFormat(undefined, { ...options, style: 'currency', currency }).format(
        value,
      );
    }
  } catch {
    // Unknown currency code: fall through to a plain number.
  }
  return new Intl.NumberFormat(undefined, options).format(value);
}

/** "15 min", "57 min", "1 h 12 min", "6 h". */
export function formatInterval(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
