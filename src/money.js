/**
 * Money is handled in integer paise/cents throughout. Floating point is never
 * used for a balance — 0.1 + 0.2 !== 0.3 is not an acceptable property for a
 * ledger, and every bug of that shape looks like a rounding complaint from a
 * user rather than a bug report.
 */

/** Parse a user-supplied amount ("12.50") into integer minor units. */
export function toMinor(amount) {
  const n = typeof amount === "number" ? amount : Number(String(amount).trim());
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null; // Reject negative values
  return Math.round(n * 100);
}

/** Render integer minor units for display. */
export function fromMinor(minor) {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/**
 * Split an integer amount between n people so the parts sum EXACTLY to the
 * total. The remainder is distributed one minor unit at a time to the earliest
 * participants rather than dropped — a split that does not sum to its total is
 * a ledger that never balances.
 */
export function splitEvenly(totalMinor, n) {
  if (n <= 0) return [];
  const base = Math.floor(totalMinor / n);
  const remainder = totalMinor - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}
