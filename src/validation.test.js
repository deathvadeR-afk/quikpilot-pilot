import { describe, it, expect } from "vitest";
import { validateExpense, ValidationError } from "./validation.js";
import { validateNonNegativeAmount } from "./validation.js";

function memberIds() {
  return ["u1", "u2", "u3"];
}

describe("validateNonNegativeAmount", () => {
  it("[QP-QUIKSPL-50-1] Rejects negative manual input in a standard amount field", () => {
    expect(() => validateNonNegativeAmount(-50)).toThrow(ValidationError);
    expect(() => validateNonNegativeAmount(-50)).toThrow("amount cannot be negative");
  });

  it("[QP-QUIKSPL-50-2] Rejects negative input via copy-paste", () => {
    expect(() => validateNonNegativeAmount("-100.50")).toThrow(ValidationError);
    expect(() => validateNonNegativeAmount("-100.50")).toThrow("amount cannot be negative");
  });

  it("[QP-QUIKSPL-50-3] Allows zero as a valid amount", () => {
    expect(() => validateNonNegativeAmount(0)).not.toThrow();
    expect(validateNonNegativeAmount(0)).toBe(0);
  });

  it("[QP-QUIKSPL-50-4] Allows positive amounts", () => {
    expect(() => validateNonNegativeAmount(123.45)).not.toThrow();
    expect(validateNonNegativeAmount(123.45)).toBe(123.45);
  });

  it("rejects non-numeric input", () => {
    expect(() => validateNonNegativeAmount("abc")).toThrow(ValidationError);
    expect(() => validateNonNegativeAmount("abc")).toThrow("amount must be a number");
  });

  it("[QP-QUIKSPL-50-5] Prevents negative amounts from being saved via API", () => {
    expect(() => validateNonNegativeAmount(-25)).toThrow(ValidationError);
    expect(() => validateNonNegativeAmount(-25)).toThrow("amount cannot be negative");
  });
});

describe("validateExpense participant validation", () => {
  it("[QP-QUIKSPL-31-1] Rejects expense with two identical participant IDs", () => {
    const members = memberIds();
    const input = { description: "Test", amount: 100, paidBy: "u1", participants: ["u1", "u1", "u2"] };
    expect(() => validateExpense(input, members)).toThrow(ValidationError);
    expect(() => validateExpense(input, members)).toThrow("Duplicate participants are not allowed");
  });

  it("[QP-QUIKSPL-31-2] Rejects expense with multiple identical participant IDs", () => {
    const members = memberIds();
    const input = { description: "Test", amount: 100, paidBy: "u1", participants: ["u1", "u2", "u1", "u3"] };
    expect(() => validateExpense(input, members)).toThrow(ValidationError);
    expect(() => validateExpense(input, members)).toThrow("Duplicate participants are not allowed");
  });

  it("[QP-QUIKSPL-31-3] Accepts expense with all distinct participant IDs", () => {
    const members = memberIds();
    const input = { description: "Test", amount: 100, paidBy: "u1", participants: ["u1", "u2", "u3"] };
    expect(() => validateExpense(input, members)).not.toThrow();
  });

  it("[QP-QUIKSPL-31-4] Accepts expense with a single participant", () => {
    const members = memberIds();
    const input = { description: "Test", amount: 100, paidBy: "u1", participants: ["u1"] };
    expect(() => validateExpense(input, members)).not.toThrow();
  });
});

describe("validateExpense category", () => {
  const base = { description: "Test", amount: 100, paidBy: "u1", participants: ["u1", "u2"] };

  it("defaults to other", () => {
    expect(validateExpense(base, memberIds()).category).toBe("other");
  });

  it("accepts a known category in any case", () => {
    expect(validateExpense({ ...base, category: " Food " }, memberIds()).category).toBe("food");
  });

  it("rejects an unknown category and names the choices", () => {
    expect(() => validateExpense({ ...base, category: "yachts" }, memberIds())).toThrow(
      "Category must be one of: food, travel, stay, entertainment, other.",
    );
  });
});

describe("validateExpense currency", () => {
  const base = { description: "Test", amount: "100.00", paidBy: "u1", participants: ["u1", "u2"] };

  it("keeps base-currency amounts as entered", () => {
    const result = validateExpense(base, memberIds());
    expect(result.amountMinor).toBe(10000);
    expect(result.original).toEqual({ amountMinor: 10000, currency: "INR" });
  });

  it("converts an amount entered in another currency and keeps what was entered", () => {
    const result = validateExpense({ ...base, currency: "USD" }, memberIds());
    expect(result.amountMinor).toBe(832000);
    expect(result.original).toEqual({ amountMinor: 10000, currency: "USD" });
  });

  it("rejects a currency code that is not three letters", () => {
    expect(() => validateExpense({ ...base, currency: "US" }, memberIds())).toThrow(
      "Currency must be a 3-letter code.",
    );
  });
});

describe("validateExpense split", () => {
  const base = { description: "Test", amount: "100.00", paidBy: "u1", participants: ["u1", "u2"] };

  it("is an equal split unless told otherwise", () => {
    const result = validateExpense(base, memberIds());
    expect(result.splitType).toBe("equal");
    expect(result.splitDetails).toBeUndefined();
  });

  it("rejects an unknown split type", () => {
    expect(() => validateExpense({ ...base, splitType: "lottery" }, memberIds())).toThrow(
      "Split type must be one of: equal, exact, percent, shares.",
    );
  });

  it("needs details for anything but an equal split", () => {
    expect(() => validateExpense({ ...base, splitType: "percent" }, memberIds())).toThrow(
      "Split details are required for this split type.",
    );
    expect(() => validateExpense({ ...base, splitType: "percent", splitDetails: { u1: 100 } }, memberIds())).toThrow(
      "A value is required for u2.",
    );
  });

  it("accepts exact amounts that add up to the total", () => {
    const result = validateExpense(
      { ...base, splitType: "exact", splitDetails: { u1: "60.00", u2: "40.00" } },
      memberIds(),
    );
    expect(result.splitDetails).toEqual({ u1: 6000, u2: 4000 });
  });

  it("rejects exact amounts that do not add up to the total", () => {
    expect(() =>
      validateExpense({ ...base, splitType: "exact", splitDetails: { u1: "60.00", u2: "30.00" } }, memberIds()),
    ).toThrow("Exact amounts must add up to the total.");
  });

  it("accepts percentages that add up to 100, including two decimals", () => {
    const result = validateExpense(
      { ...base, participants: ["u1", "u2", "u3"], splitType: "percent", splitDetails: { u1: 33.33, u2: 33.33, u3: 33.34 } },
      memberIds(),
    );
    expect(result.splitDetails).toEqual({ u1: 33.33, u2: 33.33, u3: 33.34 });
  });

  it("rejects percentages that do not add up to 100", () => {
    expect(() =>
      validateExpense({ ...base, splitType: "percent", splitDetails: { u1: 60, u2: 30 } }, memberIds()),
    ).toThrow("Percentages must add up to 100.");
  });

  it("accepts whole-number shares and rejects anything else", () => {
    const ok = validateExpense({ ...base, splitType: "shares", splitDetails: { u1: 2, u2: 1 } }, memberIds());
    expect(ok.splitDetails).toEqual({ u1: 2, u2: 1 });
    expect(() =>
      validateExpense({ ...base, splitType: "shares", splitDetails: { u1: 1.5, u2: 1 } }, memberIds()),
    ).toThrow("Shares must be whole numbers greater than zero.");
  });
});
