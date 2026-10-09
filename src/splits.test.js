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

  it("[QP-QUIKSPL-113-1] Scales shares proportionally for a simple increase", () => {
    const shares = computeShares({
      amountMinor: 2000,
      participants: ["a", "b"],
      splitType: "exact",
      splitDetails: { a: 600, b: 400 },
      originalAmountMinor: 1000
    });
    expect(shares).toEqual([1200, 800]);
  });

  it("[QP-QUIKSPL-113-2] Scales shares proportionally for a simple decrease", () => {
    const shares = computeShares({
      amountMinor: 1000,
      participants: ["a", "b"],
      splitType: "exact",
      splitDetails: { a: 1200, b: 800 },
      originalAmountMinor: 2000
    });
    expect(shares).toEqual([600, 400]);
  });

  it("[QP-QUIKSPL-113-3] Distributes remainder to largest share", () => {
    const shares = computeShares({
      amountMinor: 1001,
      participants: ["a", "b"],
      splitType: "exact",
      splitDetails: { a: 600, b: 400 },
      originalAmountMinor: 1000
    });
    expect(shares).toEqual([601, 400]);
  });

  it("[QP-QUIKSPL-113-4] Distributes remainder to earliest share with largest remainder", () => {
    const shares = computeShares({
      amountMinor: 1001,
      participants: ["a", "b"],
      splitType: "exact",
      splitDetails: { a: 500, b: 500 },
      originalAmountMinor: 1000
    });
    expect(shares).toEqual([501, 500]);
  });
});
