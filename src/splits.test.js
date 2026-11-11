import { describe, it, expect } from "vitest";
import { computeShares, weighted } from "./splits.js";
import { addExpense, computeBalances, createGroup } from "./ledger.js";

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
});

describe("percentage splits with leftover units", () => {
  it("[QP-QUIKSPL-388-1] distributes the leftover cent of a 50/50 percentage split to the earliest participant", () => {
    const shares = computeShares({
      amountMinor: 1001,
      participants: ["a", "b"],
      splitType: "percent",
      splitDetails: { a: 50, b: 50 },
    });
    expect(shares).toEqual([501, 500]);
    expect(sum(shares)).toBe(1001);
  });

  it("[QP-QUIKSPL-388-2] distributes the leftover minor unit of a 33.33/33.33/33.34 split to the largest remainder", () => {
    const shares = computeShares({
      amountMinor: 1000,
      participants: ["a", "b", "c"],
      splitType: "percent",
      splitDetails: { a: 33.33, b: 33.33, c: 33.34 },
    });
    expect(shares).toEqual([333, 333, 334]);
    expect(sum(shares)).toBe(1000);
  });
});

describe("balances after a percentage split", () => {
  it("[QP-QUIKSPL-388-3] keeps group balances at zero after a non-clean percentage split", () => {
    const g = createGroup("g", "Test", [
      { id: "A", name: "A" },
      { id: "B", name: "B" },
    ]);
    addExpense(g, {
      description: "Lunch",
      amountMinor: 1001,
      paidBy: "A",
      participants: ["A", "B"],
      splitType: "percent",
      splitDetails: { A: 50, B: 50 },
    });
    const total = Object.values(computeBalances(g)).reduce((a, b) => a + b, 0);
    expect(total).toBe(0);
  });
});
