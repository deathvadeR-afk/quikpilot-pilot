import { describe, it, expect } from "vitest";
import { computeShares, weighted } from "./splits.js";

const sum = (parts) => parts.reduce((a, b) => a + b, 0);

describe("weighted", () => {
  it("divides in proportion to the weights", () => {
    expect(weighted(1000, [1, 1, 2])).toEqual([250, 250, 500]);
  });

  it("hands leftover units to the largest remainders so the parts sum to the total", () => {
    const parts = weighted(1000, [1, 1, 1]);
    expect(sum(parts)).toBe(1000);
    expect(parts).toEqual([334, 333, 333]);
  });

  it("returns zeros for a zero total or zero weights", () => {
    expect(weighted(0, [1, 2])).toEqual([0, 0]);
    expect(weighted(500, [0, 0])).toEqual([0, 0]);
  });

  it("returns an empty list for no weights", () => {
    expect(weighted(500, [])).toEqual([]);
  });
});

describe("computeShares", () => {
  const participants = ["a", "b", "c"];

  it("splits equally by default", () => {
    expect(computeShares({ amountMinor: 900, participants })).toEqual([300, 300, 300]);
  });

  it("gives the odd unit of an equal split to the earliest participants", () => {
    expect(computeShares({ amountMinor: 1000, participants })).toEqual([334, 333, 333]);
  });

  it("uses the stated amounts for an exact split", () => {
    const shares = computeShares({
      amountMinor: 1000,
      participants,
      splitType: "exact",
      splitDetails: { a: 500, b: 300, c: 200 },
    });
    expect(shares).toEqual([500, 300, 200]);
  });

  it("applies percentages that divide the total cleanly", () => {
    const shares = computeShares({
      amountMinor: 20000,
      participants,
      splitType: "percent",
      splitDetails: { a: 50, b: 30, c: 20 },
    });
    expect(shares).toEqual([10000, 6000, 4000]);
  });

  it("divides by shares and keeps the parts summing to the total", () => {
    const shares = computeShares({
      amountMinor: 1001,
      participants,
      splitType: "shares",
      splitDetails: { a: 1, b: 1, c: 1 },
    });
    expect(sum(shares)).toBe(1001);
  });

  it("rejects an unknown split type", () => {
    expect(() => computeShares({ amountMinor: 100, participants, splitType: "random" })).toThrow("Unknown split type");
  });

  it("[QP-QUIKSPL-202-1] Scales shares proportionally for an exact split with even rounding", () => {
    const shares = computeShares({
      amountMinor: 2000,
      participants: ["a", "b"],
      splitType: "exact",
      splitDetails: { a: 600, b: 400 },
      originalAmountMinor: 1000,
    });
    expect(shares).toEqual([1200, 800]);
    expect(sum(shares)).toBe(2000);
  });

  it("[QP-QUIKSPL-202-2] Scales shares proportionally for an exact split with uneven rounding", () => {
    const shares = computeShares({
      amountMinor: 1001,
      participants: ["a", "b", "c"],
      splitType: "exact",
      splitDetails: { a: 333, b: 333, c: 334 },
      originalAmountMinor: 1000,
    });
    expect(sum(shares)).toBe(1001);
    // The exact distribution of minor units is handled by the weighted function
    // which distributes to largest remainders, earliest first.
    // 333 * 1.001 = 333.333 -> 333
    // 333 * 1.001 = 333.333 -> 333
    // 334 * 1.001 = 334.334 -> 334
    // Total = 1000. The remaining 1 unit should go to 'c' (largest remainder)
    // or 'a' (earliest if tie). Here, 'c' has the largest remainder.
    // The weighted function will handle the distribution correctly.
    // For 1001 / 1000 scaling, shares become 333.333, 333.333, 334.334
    // After floor: 333, 333, 334. Sum = 1000. Remainder = 1.
    // Remainders: a: 0.333, b: 0.333, c: 0.334. 'c' gets the extra unit.
    expect(shares).toEqual([333, 333, 335]);
  });

  it("[QP-QUIKSPL-202-3] Maintains shares for a percentage split when amount is edited", () => {
    const shares = computeShares({
      amountMinor: 20000,
      participants: ["a", "b"],
      splitType: "percent",
      splitDetails: { a: 50, b: 50 },
      originalAmountMinor: 10000,
    });
    expect(shares).toEqual([10000, 10000]);
    expect(sum(shares)).toBe(20000);
  });

  it("[QP-QUIKSPL-202-4] Handles zero initial shares correctly when scaling", () => {
    const shares = computeShares({
      amountMinor: 2000,
      participants: ["a", "b"],
      splitType: "exact",
      splitDetails: { a: 1000, b: 0 },
      originalAmountMinor: 1000,
    });
    expect(shares).toEqual([2000, 0]);
    expect(sum(shares)).toBe(2000);
  });

  it("[QP-QUIKSPL-202-5] Handles decrease in expense amount for exact split", () => {
    const shares = computeShares({
      amountMinor: 1000,
      participants: ["a", "b"],
      splitType: "exact",
      splitDetails: { a: 1200, b: 800 },
      originalAmountMinor: 2000,
    });
    expect(shares).toEqual([600, 400]);
    expect(sum(shares)).toBe(1000);
  });
});
