import { splitEvenly } from "./money.js";

/**
 * How an expense is divided between its participants. Every function here
 * returns integer minor units, one per participant, in participant order.
 *
 *   equal    everyone pays the same (the remainder goes to the earliest)
 *   exact    each participant owes a stated amount
 *   percent  each participant owes a stated percentage of the total
 *   shares   each participant owes in proportion to a whole-number weight
 */
export const SPLIT_TYPES = ["equal", "exact", "percent", "shares"];

/**
 * Divide `total` in proportion to `weights` so the parts sum EXACTLY to the
 * total. Each part is rounded down, then the units left over are handed out by
 * largest fractional remainder, earliest participant first on a tie.
 */
export function weighted(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  if (total === 0 || sum === 0) return weights.map(() => 0);

  const parts = weights.map((w) => Math.floor((total * w) / sum));
  const remainders = weights.map((w, i) => ({ i, rem: (total * w) % sum }));
  let left = total - parts.reduce((a, b) => a + b, 0);

  remainders.sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of remainders) {
    if (left === 0) break;
    parts[i] += 1;
    left -= 1;
  }
  return parts;
}

/** What each participant owes for one expense, in participant order. */
export function scaleExactShares(originalAmountMinor, newAmountMinor, splitDetails, participants) {
  if (newAmountMinor < 0) {
    throw new Error("New amount cannot be negative.");
  }

  const originalShares = participants.map((p) => splitDetails[p]);
  const originalTotal = originalShares.reduce((a, b) => a + b, 0);

  if (originalTotal === 0) {
    // If original total was 0, and new amount is also 0, shares remain 0.
    // If new amount is not 0, distribute equally or throw error if not possible.
    if (newAmountMinor === 0) {
      return Object.fromEntries(participants.map((p) => [p, 0]));
    } else {
      // This case might need more specific handling based on business rules
      // For now, let's assume it's an invalid state or requires manual intervention
      throw new Error("Cannot scale shares from a zero total to a non-zero amount.");
    }
  }

  const scaleFactor = newAmountMinor / originalTotal;
  const scaledShares = originalShares.map((share) => share * scaleFactor);

  const roundedShares = scaledShares.map((share) => Math.floor(share));
  let remainder = newAmountMinor - roundedShares.reduce((a, b) => a + b, 0);

  if (remainder < 0) {
    throw new Error("Scaling resulted in a negative remainder, which should not happen with floor rounding.");
  }

  const fractionalRemainders = scaledShares.map((share, i) => ({
    i,
    rem: share - Math.floor(share),
    originalIndex: i,
  }));

  // Sort by largest fractional remainder, then by original index for ties
  fractionalRemainders.sort((a, b) => b.rem - a.rem || a.originalIndex - b.originalIndex);

  for (const { i } of fractionalRemainders) {
    if (remainder === 0) break;
    roundedShares[i] += 1;
    remainder -= 1;
  }

  // Validate that no share became negative after scaling and rounding
  if (roundedShares.some((share) => share < 0)) {
    throw new Error("Scaling would result in a negative share.");
  }

  return Object.fromEntries(participants.map((p, i) => [p, roundedShares[i]]));
}

/** What each participant owes for one expense, in participant order. */
export function computeShares(expense) {
  const { amountMinor, participants, splitType = "equal", splitDetails } = expense;

  switch (splitType) {
    case "equal":
      return splitEvenly(amountMinor, participants.length);

    case "exact":
      return participants.map((p) => splitDetails[p]);

    case "percent":
      return participants.map((p) => Math.round((amountMinor * splitDetails[p]) / 100));

    case "shares":
      return weighted(
        amountMinor,
        participants.map((p) => splitDetails[p]),
      );

    default:
      throw new Error(`Unknown split type: ${splitType}`);
  }
}
