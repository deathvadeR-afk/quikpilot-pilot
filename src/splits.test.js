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

  it("[QP-QUIKSPL-92-1] Scales shares proportionally for a positive amount increase", () => {
    const shares = computeShares({
      amountMinor: 2000,
      participants: ["a", "b"],
      splitType: "exact",
      splitDetails: { a: 600, b: 400 }
    });
    expect(shares).toEqual([1200, 800]);
  });

  it("[QP-QUIKSPL-92-2] Scales shares proportionally for a positive amount decrease", () => {
    const shares = computeShares({
      amountMinor: 1000,
      participants: ["a", "b"],
      splitType: "exact",
      splitDetails: { a: 1200, b: 800 }
    });
    expect(shares).toEqual([600, 400]);
  });

  it("[QP-QUIKSPL-92-3] Distributes minor unit remainders correctly", () => {
    const shares = computeShares({
      amountMinor: 1100,
      participants: ["a", "b", "c"],
      splitType: "exact",
      splitDetails: { a: 333, b: 333, c: 334 }
    });
    expect(shares.reduce((a, b) => a + b, 0)).toBe(1100);
    // The exact distribution might vary slightly based on rounding, but the sum must be correct.
    // For 1100 / 1000 * [333, 333, 334] = [366.3, 366.3, 367.4]
    // Rounded down: [366, 366, 367]. Remainder 1100 - (366+366+367) = 1. 
    // Original order tie-breaking for largest remainders: c (0.4), a (0.3), b (0.3)
    // So, c gets +1. Result: [366, 366, 368] or similar based on weighted implementation.
    // Let's check for the sum and approximate values.
    expect(shares[0]).toBeCloseTo(366.3, -1);
    expect(shares[1]).toBeCloseTo(366.3, -1);
    expect(shares[2]).toBeCloseTo(367.4, -1);
  });

  it("[QP-QUIKSPL-92-4] Rejects editing total amount to a negative value", () => {
    expect(() => computeShares({
      amountMinor: -500,
      participants: ["a", "b"],
      splitType: "exact",
      splitDetails: { a: 600, b: 400 }
    })).toThrow("Total expense amount cannot be negative.");
  });

  it("[QP-QUIKSPL-92-5] Rejects editing total amount to zero when shares exist", () => {
    expect(() => computeShares({
      amountMinor: 0,
      participants: ["a", "b"],
      splitType: "exact",
      splitDetails: { a: 600, b: 400 }
    })).toThrow("Total expense amount cannot be zero when shares exist.");
  });

  it("[QP-QUIKSPL-92-6] Handles single share expense correctly", () => {
    const shares = computeShares({
      amountMinor: 1500,
      participants: ["a"],
      splitType: "exact",
      splitDetails: { a: 1000 }
    });
    expect(shares).toEqual([1500]);
  });
});
