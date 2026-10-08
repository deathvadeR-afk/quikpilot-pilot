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
      if (expense.originalAmountMinor === undefined) {
        // This is a new expense, or an existing one not being edited for total amount
        return originalShares;
      }
      // Editing an existing exact split expense with a new total amount
      const newTotal = expense.amountMinor;
      const oldTotal = expense.originalAmountMinor;

      if (newTotal < 0) {
        throw new Error("Total expense amount cannot be negative.");
      }
      if (newTotal === 0 && originalShares.length > 0) {
        throw new Error("Total expense amount cannot be zero when shares exist.");
      }

      if (oldTotal === 0) {
        // If the old total was zero, and new total is not zero, distribute evenly
        return splitEvenly(newTotal, participants.length);
      }

      const ratio = newTotal / oldTotal;
      const scaledShares = originalShares.map((share) => share * ratio);

      // Distribute remainders
      const flooredShares = scaledShares.map((s) => Math.floor(s));
      let remainder = newTotal - flooredShares.reduce((a, b) => a + b, 0);

      const fractionalParts = scaledShares.map((s, i) => ({ i, frac: s - Math.floor(s) }));
      fractionalParts.sort((a, b) => b.frac - a.frac || a.i - b.i);

      for (const { i } of fractionalParts) {
        if (remainder === 0) break;
        flooredShares[i] += 1;
        remainder -= 1;
      }
      return flooredShares;
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
