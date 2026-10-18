import { describe, it, expect } from "vitest";
import { validateExpense, ValidationError } from "./validation.js";

function memberIds() {
  return ["u1", "u2", "u3"];
}

const base = { description: "Test", amount: "100.00", paidBy: "u1", participants: ["u1", "u2"] };

function errorFor(input) {
  try {
    validateExpense(input, memberIds());
  } catch (err) {
    return err;
  }
  return null;
}

describe("validateExpense currency codes", () => {
  it("[QP-QUIKSPL-281-1] Converts a lowercase currency code the same as its uppercase form", () => {
    const result = validateExpense({ ...base, currency: "usd" }, memberIds());
    expect(result.amountMinor).toBe(832000);
  });

  it("[QP-QUIKSPL-281-2] Rejects an unknown three-letter currency code with a ValidationError", () => {
    const err = errorFor({ ...base, currency: "XYZ" });
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.field).toBe("currency");
    expect(err.message).toBe("Unsupported currency: XYZ.");
  });

  it("[QP-QUIKSPL-281-3] Shows an unsupported lowercase code in capitals in the error message", () => {
    const err = errorFor({ ...base, currency: "xyz" });
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.field).toBe("currency");
    expect(err.message).toBe("Unsupported currency: XYZ.");
  });

  it("[QP-QUIKSPL-281-4] Rejects a currency code that is not exactly three letters", () => {
    const err = errorFor({ ...base, currency: "US1" });
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.field).toBe("currency");
  });
});
