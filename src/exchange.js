/**
 * Expenses can be entered in another currency and are held in the group's base
 * currency. Rates are fixed for the pilot: base-currency units per one unit of
 * the foreign currency.
 */
export const BASE_CURRENCY = "INR";

const RATES = {
  INR: 1,
  USD: 83.2,
  EUR: 90.5,
  GBP: 105.75,
  AED: 22.65,
};

export function supportedCurrencies() {
  return Object.keys(RATES);
}

export function rateFor(currency) {
  return RATES[currency] ?? 1;
}

/** Convert an integer amount in `currency` minor units into base-currency minor units. */
export function convertToBase(amountMinor, currency = BASE_CURRENCY) {
  return Math.round(amountMinor * rateFor(currency));
}
