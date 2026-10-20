import { describe, it, expect } from "vitest";
import { BASE_CURRENCY, convertToBase, supportedCurrencies } from "./exchange.js";
import { createGroup, addExpense } from "./ledger.js";
import { validateExpense, ValidationError } from "./validation.js";

describe("convertToBase", () => {
  it("leaves base-currency amounts alone", () => {
    expect(BASE_CURRENCY).toBe("INR");
    expect(convertToBase(12345, "INR")).toBe(12345);
    expect(convertToBase(12345)).toBe(12345);
  });

  it("converts a foreign amount at the fixed rate", () => {
    expect(convertToBase(10000, "USD")).toBe(832000);
    expect(convertToBase(10000, "EUR")).toBe(905000);
  });

  it("rounds to a whole minor unit", () => {
    expect(Number.isInteger(convertToBase(333, "GBP"))).toBe(true);
  });

  it("lists the currencies it can convert", () => {
    expect(supportedCurrencies()).toEqual(["INR", "USD", "EUR", "GBP", "AED"]);
  });
});

describe("expense currency codes", () => {
  const members = ["u1"];
  const expenseWith = (currency) => ({
    description: "Lunch",
    amount: 100,
    paidBy: "u1",
    participants: ["u1"],
    currency,
  });
  const errorFrom = (fn) => {
    try {
      fn();
    } catch (e) {
      return e;
    }
    return undefined;
  };

  it("[QP-QUIKSPL-290-1] Converts a lowercase currency code the same as its uppercase form", () => {
    const lower = validateExpense(expenseWith("usd"), members);
    const upper = validateExpense(expenseWith("USD"), members);
    expect(lower.amountMinor).toBe(832000);
    expect(lower.amountMinor).toBe(upper.amountMinor);
  });

  it("[QP-QUIKSPL-290-2] Accepts a mixed-case currency code and normalises it", () => {
    const result = validateExpense(expenseWith("Usd"), members);
    expect(result.amountMinor).toBe(832000);
  });

  it("[QP-QUIKSPL-290-3] Rejects an unknown three-letter currency code on the currency field", () => {
    const err = errorFrom(() => validateExpense(expenseWith("XYZ"), members));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.field).toBe("currency");
  });

  it("[QP-QUIKSPL-290-4] Reports the unsupported code in capitals in the error message", () => {
    const err = errorFrom(() => validateExpense(expenseWith("xyz"), members));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toBe("Unsupported currency: XYZ.");
  });

  it("[QP-QUIKSPL-290-5] Stores no expense when the currency is unsupported", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    expect(() => addExpense(g, expenseWith("XYZ"))).toThrow();
    expect(g.expenses).toHaveLength(0);
  });
});
