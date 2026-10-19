import { describe, it, expect } from "vitest";
import { BASE_CURRENCY, convertToBase, supportedCurrencies } from "./exchange.js";
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

describe("validateExpense currency code case handling", () => {
  const ids = ["u1", "u2", "u3"];
  const base = { description: "Test", amount: "100.00", paidBy: "u1", participants: ["u1", "u2"] };

  it("[QP-QUIKSPL-291-1] Converts a lowercase currency code the same as its uppercase form", () => {
    const lower = validateExpense({ ...base, currency: "usd" }, ids);
    const upper = validateExpense({ ...base, currency: "USD" }, ids);
    expect(lower.amountMinor).toBe(832000);
    expect(lower.amountMinor).toBe(upper.amountMinor);
  });

  it("[QP-QUIKSPL-291-2] Accepts a mixed-case currency code and saves the same converted amount", () => {
    const mixed = validateExpense({ ...base, currency: "Usd" }, ids);
    const upper = validateExpense({ ...base, currency: "USD" }, ids);
    expect(mixed.amountMinor).toBe(upper.amountMinor);
    expect(mixed.amountMinor).toBe(832000);
  });

  it("[QP-QUIKSPL-291-3] Rejects an unknown three-letter currency code with a currency field error", () => {
    let error;
    try {
      validateExpense({ ...base, currency: "XYZ" }, ids);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.field).toBe("currency");
    expect(error.message).toBe("Unsupported currency: XYZ.");
  });

  it("[QP-QUIKSPL-291-4] Does not create an expense when the currency is unsupported", () => {
    const saved = [];
    const save = (input) => saved.push(validateExpense(input, ids));
    expect(() => save({ ...base, currency: "XYZ" })).toThrow(ValidationError);
    expect(saved.length).toBe(0);
  });

  it("[QP-QUIKSPL-291-5] Shows the rejected code in capitals when entered in lowercase", () => {
    let error;
    try {
      validateExpense({ ...base, currency: "xyz" }, ids);
    } catch (e) {
      error = e;
    }
    expect(error.field).toBe("currency");
    expect(error.message).toBe("Unsupported currency: XYZ.");
  });
});
