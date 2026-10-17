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
export function computeShares(expense) {
  const { amountMinor, participants, splitType = "equal", splitDetails } = expense;

  switch (splitType) {
    case "equal":
      return splitEvenly(amountMinor, participants.length);

    case "exact": {
      const originalShares = participants.map((p) => splitDetails[p]);
      const originalTotal = originalShares.reduce((sum, share) => sum + share, 0);

      if (originalTotal === 0) {
        // If original total is zero, distribute new amount evenly or based on implicit proportions if available
        if (amountMinor === 0) {
          return originalShares.map(() => 0);
        } else {
          // If original shares were all zero, distribute new amount evenly
          // If there's an implicit proportion (e.g., from a previous state not captured here), it's not directly accessible.
          // For now, assume equal distribution if all original shares were zero.
          return splitEvenly(amountMinor, participants.length);
        }
      }

      const scalingFactor = amountMinor / originalTotal;
      let scaledShares = originalShares.map((share) => Math.floor(share * scalingFactor));
      let remainder = amountMinor - scaledShares.reduce((sum, share) => sum + share, 0);

      // Distribute remainder based on largest fractional parts, then original order
      const fractionalParts = originalShares.map((share, i) => ({
        i,
        fraction: (share * scalingFactor) % 1,
      }));

      fractionalParts.sort((a, b) => b.fraction - a.fraction || a.i - b.i);

      for (const { i } of fractionalParts) {
        if (remainder === 0) break;
        scaledShares[i] += 1;
        remainder -= 1;
      }
      return scaledShares;
    }

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
