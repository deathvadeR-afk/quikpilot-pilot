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

  it("[QP-QUIKSPL-39-1] Splits 10.01 into 50/50, distributing remainder to first participant", () => {
    const shares = computeShares({
      amountMinor: 1001,
      participants: ["a", "b"],
      splitType: "percent",
      splitDetails: { a: 50, b: 50 }
    });
    expect(shares).toEqual([501, 500]);
  });

  it("[QP-QUIKSPL-39-2] Splits 10.00 into 33.33/33.33/33.34, distributing remainders correctly", () => {
    const shares = computeShares({
      amountMinor: 1000,
      participants: ["a", "b", "c"],
      splitType: "percent",
      splitDetails: { a: 33.33, b: 33.33, c: 33.34 }
    });
    expect(shares).toEqual([333, 333, 334]);
  });

  it("[QP-QUIKSPL-39-3] Splits 10.00 into 33.33/33.33/33.33, distributing remainders by largest and earliest", () => {
    const shares = computeShares({
      amountMinor: 1000,
      participants: ["a", "b", "c"],
      splitType: "percent",
      splitDetails: { a: 33.33, b: 33.33, c: 33.33 }
    });
    expect(shares).toEqual([334, 333, 333]);
  });

  it("[QP-QUIKSPL-39-4] Splits 10.00 into 25/25/25/25, ensuring no change for clean splits", () => {
    const participants = ["a", "b", "c", "d"];
    const shares = computeShares({
      amountMinor: 1000,
      participants,
      splitType: "percent",
      splitDetails: { a: 25, b: 25, c: 25, d: 25 }
    });
    expect(shares).toEqual([250, 250, 250, 250]);
  });

  it("[QP-QUIKSPL-39-5] Splits 10.00 into 10/20/30/40, ensuring no change for clean splits", () => {
    const participants = ["a", "b", "c", "d"];
    const shares = computeShares({
      amountMinor: 1000,
      participants,
      splitType: "percent",
      splitDetails: { a: 10, b: 20, c: 30, d: 40 }
    });
    expect(shares).toEqual([100, 200, 300, 400]);
  });
});
