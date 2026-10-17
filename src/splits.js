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

    case "exact":
      return participants.map((p) => splitDetails[p]);

    case "percent": {
      const unroundedShares = participants.map((p) => (amountMinor * splitDetails[p]) / 100);
      const initialRoundedShares = unroundedShares.map((share) => Math.round(share));
      let sumRoundedShares = initialRoundedShares.reduce((a, b) => a + b, 0);
      let remainder = amountMinor - sumRoundedShares;

      if (remainder !== 0) {
        const fractionalRemainders = unroundedShares.map((share, i) => ({
          i,
          rem: share - Math.round(share),
        }));

        // Sort by absolute fractional remainder (descending), then by original index (ascending)
        fractionalRemainders.sort((a, b) => {
          // Sort by absolute fractional remainder (descending), then by original index (ascending)
          const absRemA = Math.abs(a.rem);
          const absRemB = Math.abs(b.rem);
          if (absRemB !== absRemA) {
            return absRemB - absRemA;
          }
          return a.i - b.i;
        });

        for (const { i } of fractionalRemainders) {
          if (remainder === 0) break;
          if (remainder > 0) {
            initialRoundedShares[i] += 1;
            remainder -= 1;
          } else if (remainder < 0) {
            initialRoundedShares[i] -= 1;
            remainder += 1;
          }
        }
      }
      return initialRoundedShares;
    }

    case "shares":
      return weighted(
        amountMinor,
        participants.map((p) => splitDetails[p]),
      );

    default:
      throw new Error(`Unknown split type: ${splitType}`);
  }
}
