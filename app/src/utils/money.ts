/**
 * Amounts cross the wire as integer minor units (paise/cents) and are only
 * turned into a display string here, at the very edge.
 */
export function formatMoney(minor: number, currency = 'INR'): string {
  const major = minor / 100;

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    // Some Hermes builds ship without full ICU data.
    return `${currency} ${major.toFixed(2)}`;
  }
}

/** Compact form for the summary card, e.g. ₹1.2k. */
export function formatMoneyCompact(minor: number, currency = 'INR'): string {
  const major = minor / 100;
  if (Math.abs(major) < 1000) return formatMoney(minor, currency);

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(major);
  } catch {
    return formatMoney(minor, currency);
  }
}
