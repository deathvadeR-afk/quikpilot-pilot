import { describe, it, expect } from "vitest";
import { computeShares } from "./splits.js";

describe("computeShares proportional scaling and remainder distribution", () => {
  it("[QP-QUIKSPL-84-1] Scales shares proportionally for a positive amount increase", () => {
    const participants = ["a", "b"];
    const shares = computeShares({
      amountMinor: 2000,
      participants,
      splitType: "exact",
      splitDetails: { a: 600, b: 400 },
      originalAmountMinor: 1000
    });
    expect(shares).toEqual([1200, 800]);
  });

  it("[QP-QUIKSPL-84-2] Scales shares proportionally for a positive amount decrease", () => {
    const participants = ["a", "b"];
    const shares = computeShares({
      amountMinor: 1000,
      participants,
      splitType: "exact",
      splitDetails: { a: 1200, b: 800 },
      originalAmountMinor: 2000
    });
    expect(shares).toEqual([600, 400]);
  });

  it("[QP-QUIKSPL-84-3] Distributes minor unit remainders correctly", () => {
    const participants = ["a", "b", "c"];
    const shares = computeShares({
      amountMinor: 1100,
      participants,
      splitType: "exact",
      splitDetails: { a: 333, b: 333, c: 334 },
      originalAmountMinor: 1000
    });
    // Expected shares: 3.663, 3.663, 3.674 -> 366, 366, 367 (sum 1099) + 1 remainder
    // Distribute 1 remainder to the first share with largest remainder (a or b)
    // Or based on original order if remainders are equal
    // 3.663 -> 366, 3.663 -> 366, 3.674 -> 367
    // New total 1100. Ratio 1.1
    // Original: 333, 333, 334. Scaled: 366.3, 366.3, 367.4
    // Rounded: 366, 366, 367. Sum: 1099. Remainder: 1
    // Distribute to largest fractional part: 367.4 (c), then 366.3 (a), then 366.3 (b)
    // So c gets +1. Result: 366, 366, 368. This is one possible correct distribution.
    // The problem statement says "breaking ties by original order", so a gets it.
    // 366.3 (a), 366.3 (b), 367.4 (c)
    // Remainders: 0.3, 0.3, 0.4
    // Sorted by remainder (desc) then original order (asc): c (0.4), a (0.3), b (0.3)
    // So c gets +1. Result: 366, 366, 368.
    // Let's re-evaluate the distribution logic. The prompt says "distribute any minor unit remainders to shares with the largest remainders, breaking ties by original order."
    // Original shares: 333, 333, 334. Total 1000.
    // New total: 1100. Ratio: 1.1.
    // Scaled shares (float): 333 * 1.1 = 366.3, 333 * 1.1 = 366.3, 334 * 1.1 = 367.4
    // Floor values: 366, 366, 367. Sum = 1099.
    // Remainder to distribute: 1100 - 1099 = 1.
    // Fractional parts: 0.3 (a), 0.3 (b), 0.4 (c).
    // Sorted by fractional part (descending), then original order (ascending):
    // 1. c (0.4)
    // 2. a (0.3)
    // 3. b (0.3)
    // So, 'c' gets the +1. Final shares: 366, 366, 368.
    expect(shares).toEqual([366, 366, 368]);
  });

  it("[QP-QUIKSPL-84-6] Handles single share expense correctly", () => {
    const participants = ["a"];
    const shares = computeShares({
      amountMinor: 1500,
      participants,
      splitType: "exact",
      splitDetails: { a: 1000 },
      originalAmountMinor: 1000
    });
    expect(shares).toEqual([1500]);
  });
});
