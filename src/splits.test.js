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

  it("[QP-QUIKSPL-226-1] Scales shares proportionally for an exact split when amount doubles", () => {
    const shares = computeShares({
      amountMinor: 2000,
      participants: ["u1", "u2"],
      splitType: "exact",
      splitDetails: { u1: 1200, u2: 800 },
      originalAmountMinor: 1000
    });
    expect(shares).toEqual([1200, 800]);
    expect(sum(shares)).toBe(2000);
  });

  it("[QP-QUIKSPL-226-2] Scales shares proportionally for an exact split when amount halves", () => {
    const shares = computeShares({
      amountMinor: 1000,
      participants: ["u1", "u2"],
      splitType: "exact",
      splitDetails: { u1: 600, u2: 400 },
      originalAmountMinor: 2000
    });
    expect(shares).toEqual([600, 400]);
    expect(sum(shares)).toBe(1000);
  });

  it("[QP-QUIKSPL-226-3] Distributes minor unit remainder to largest remainder, earliest first", () => {
    const shares = computeShares({
      amountMinor: 1001,
      participants: ["u1", "u2", "u3"],
      splitType: "exact",
      splitDetails: { u1: 333, u2: 333, u3: 334 },
      originalAmountMinor: 1000
    });
    expect(shares).toEqual([333, 333, 334]);
    expect(sum(shares)).toBe(1000);
  });

  it("[QP-QUIKSPL-226-4] Does not scale shares for a non-exact split type when amount changes", () => {
    const shares = computeShares({
      amountMinor: 2000,
      participants: ["u1", "u2"],
      splitType: "percent",
      splitDetails: { u1: 60, u2: 40 },
      originalAmountMinor: 1000
    });
    expect(shares).toEqual([1200, 800]);
    expect(sum(shares)).toBe(2000);
  });

  it("[QP-QUIKSPL-226-5] Handles zero original amount gracefully", () => {
    const shares = computeShares({
      amountMinor: 1000,
      participants: ["u1", "u2"],
      splitType: "exact",
      splitDetails: { u1: 0, u2: 0 },
      originalAmountMinor: 0
    });
    expect(shares).toEqual([0, 0]);
    expect(sum(shares)).toBe(0);
  });
});
