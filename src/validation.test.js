import { describe, it, expect } from "vitest";
import { validateExpense, ValidationError } from "./validation.js";

function memberIds() {
  return ["u1", "u2", "u3"];
}

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
