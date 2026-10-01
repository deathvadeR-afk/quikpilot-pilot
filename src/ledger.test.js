import { describe, it, expect } from "vitest";
import { createGroup, addExpense, computeBalances, assertBalanced, settleUp } from "./ledger.js";
import { ValidationError } from "./validation.js";

function group() {
  return createGroup("g", "Test", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
    { id: "u3", name: "C" },
  ]);
}

describe("computeBalances", () => {
  it("credits the payer and debits each participant", () => {
    const g = group();
    addExpense(g, { description: "Dinner", amountMinor: 900, paidBy: "u1", participants: ["u1", "u2", "u3"] });
    const b = computeBalances(g);
    expect(b.u1).toBe(600);
    expect(b.u2).toBe(-300);
    expect(b.u3).toBe(-300);
  });

  it("balances to zero on an amount that does not divide evenly", () => {
    const g = group();
    addExpense(g, { description: "Taxi", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2", "u3"] });
    assertBalanced(computeBalances(g));
  });
});

describe("settleUp", () => {
  it("produces payments that clear every balance", () => {
    const g = group();
    addExpense(g, { description: "Hotel", amountMinor: 3000, paidBy: "u1", participants: ["u1", "u2", "u3"] });
    const payments = settleUp(computeBalances(g));
    const net = {};
    for (const p of payments) {
      net[p.from] = (net[p.from] ?? 0) - p.amountMinor;
      net[p.to] = (net[p.to] ?? 0) + p.amountMinor;
    }
    expect(net.u2).toBe(-1000);
    expect(net.u3).toBe(-1000);
    expect(net.u1).toBe(2000);
  });
});

describe("addExpense amount validation", () => {
  it("[QP-QUIKSPL-28-1] Rejects negative integer input in a standard numeric field", () => {
    const g = group();
    expect(() =>
      addExpense(g, { description: "Negative Int", amountMinor: -500, paidBy: "u1", participants: ["u1"] })
    ).toThrow(ValidationError);
  });

  it("[QP-QUIKSPL-28-2] Rejects negative decimal input in a standard numeric field", () => {
    const g = group();
    expect(() =>
      addExpense(g, { description: "Negative Dec", amountMinor: -1050, paidBy: "u1", participants: ["u1"] })
    ).toThrow(ValidationError);
  });

  it("[QP-QUIKSPL-28-3] Accepts zero as valid input in a numeric field", () => {
    const g = group();
    const expense = addExpense(g, { description: "Zero Amount", amountMinor: 0, paidBy: "u1", participants: ["u1"] });
    expect(expense).toBeDefined();
    expect(expense.amountMinor).toBe(0);
  });

  it("[QP-QUIKSPL-28-4] Accepts positive integer input in a numeric field", () => {
    const g = group();
    const expense = addExpense(g, { description: "Positive Int", amountMinor: 1000, paidBy: "u1", participants: ["u1"] });
    expect(expense).toBeDefined();
    expect(expense.amountMinor).toBe(1000);
  });

  it("[QP-QUIKSPL-28-5] Existing positive data remains unchanged", () => {
    const g = group();
    addExpense(g, { description: "Existing Positive", amountMinor: 10000, paidBy: "u1", participants: ["u1"] });
    const expense = g.expenses[0];
    expect(expense.amountMinor).toBe(10000);
  });
});
