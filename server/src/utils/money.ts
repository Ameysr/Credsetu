/**
 * Money helpers.
 *
 * Rupees/dollars are stored as integers in the smallest unit (paise/cents).
 * 0.1 + 0.2 !== 0.3 in IEEE-754, and a ledger that is off by a paisa is a
 * ledger nobody trusts, so no float ever touches a stored amount.
 */

/** Currencies whose minor unit is 1/100. Enough for this app. */
const MINOR_UNIT_EXPONENT = 2;

/** Converts a user-supplied decimal amount into minor units. */
export function toMinor(amount: number | string): number {
  const parsed = typeof amount === 'string' ? Number(amount) : amount;

  if (!Number.isFinite(parsed)) {
    throw new RangeError(`Amount must be a finite number, received "${amount}"`);
  }
  if (parsed <= 0) {
    throw new RangeError('Amount must be greater than zero');
  }

  // Multiply on the string form to keep 100.10 -> 10010 exact, then round away
  // any float noise (e.g. 19.99 * 100 === 1998.9999999999998).
  const minor = Math.round(parsed * 10 ** MINOR_UNIT_EXPONENT);

  if (!Number.isSafeInteger(minor)) {
    throw new RangeError(`Amount is too large: "${amount}"`);
  }

  return minor;
}

/** Minor units back to a decimal number, for responses and CSV export. */
export function toMajor(minor: number): number {
  return minor / 10 ** MINOR_UNIT_EXPONENT;
}

/** Human-readable string, e.g. 50050 -> "INR 500.50". */
export function formatMinor(minor: number, currency = 'INR'): string {
  return `${currency} ${toMajor(minor).toFixed(MINOR_UNIT_EXPONENT)}`;
}
