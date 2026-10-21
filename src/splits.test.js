import { describe, it, expect } from "vitest";
import { computeShares, weighted } from "./splits.js";
import { createGroup, addExpense, computeBalances } from "./ledger.js";

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

  it("[QP-QUIKSPL-316-1] Shares total the expense exactly for a 50/50 split of 10.01", () => {
    const shares = computeShares({
      amountMinor: 1001,
      participants: ["a", "b"],
      splitType: "percent",
      splitDetails: { a: 50, b: 50 },
    });
    expect(shares).toEqual([501, 500]);
    expect(sum(shares)).toBe(1001);
  });

  it("[QP-QUIKSPL-316-2] The extra minor unit goes to the participant with the largest remainder", () => {
    const shares = computeShares({
      amountMinor: 1000,
      participants,
      splitType: "percent",
      splitDetails: { a: 33.33, b: 33.33, c: 33.34 },
    });
    expect(shares).toEqual([333, 333, 334]);
    expect(sum(shares)).toBe(1000);
  });

  it("[QP-QUIKSPL-316-3] Clean percentage splits keep their existing share values", () => {
    const shares = computeShares({
      amountMinor: 10000,
      participants,
      splitType: "percent",
      splitDetails: { a: 25, b: 25, c: 50 },
    });
    expect(shares).toEqual([2500, 2500, 5000]);
  });

  it("[QP-QUIKSPL-316-4] Group balances sum to zero after a percentage split", () => {
    const group = createGroup("g1", "Trip", [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
    ]);
    addExpense(group, {
      description: "Dinner",
      amountMinor: 1000,
      paidBy: "a",
      participants: ["a", "b", "c"],
      splitType: "percent",
      splitDetails: { a: 33.33, b: 33.33, c: 33.34 },
    });
    const balances = computeBalances(group);
    expect(Object.values(balances).reduce((x, y) => x + y, 0)).toBe(0);
  });
});
