import { describe, it, expect } from "vitest";
import {
  createGroup,
  addExpense,
  addMember,
  computeBalances,
  assertBalanced,
  deleteExpense,
  recordPayment,
  removeMember,
  settleUp,
  updateExpense,
} from "./ledger.js";
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

describe("payments", () => {
  it("moves both balances towards zero", () => {
    const g = group();
    addExpense(g, { description: "Dinner", amountMinor: 900, paidBy: "u1", participants: ["u1", "u2", "u3"] });
    recordPayment(g, { from: "u2", to: "u1", amountMinor: 300 });
    const b = computeBalances(g);
    expect(b.u1).toBe(300);
    expect(b.u2).toBe(0);
    expect(b.u3).toBe(-300);
    assertBalanced(b);
  });

  it("rejects a payment to oneself, a non-member, or a non-positive amount", () => {
    const g = group();
    expect(() => recordPayment(g, { from: "u1", to: "u1", amountMinor: 100 })).toThrow("cannot pay themselves");
    expect(() => recordPayment(g, { from: "u1", to: "zz", amountMinor: 100 })).toThrow("recipient must be a member");
    expect(() => recordPayment(g, { from: "u1", to: "u2", amountMinor: 0 })).toThrow("greater than zero");
  });
});

describe("deleteExpense", () => {
  it("takes the expense out of the balances", () => {
    const g = group();
    addExpense(g, { description: "Dinner", amountMinor: 900, paidBy: "u1", participants: ["u1", "u2", "u3"] });
    addExpense(g, { description: "Taxi", amountMinor: 600, paidBy: "u2", participants: ["u1", "u2", "u3"] });
    deleteExpense(g, "exp_2");
    const b = computeBalances(g);
    expect(b.u1).toBe(600);
    expect(b.u2).toBe(-300);
    assertBalanced(b);
  });

  it("keeps the expense on record with a deletion time", () => {
    const g = group();
    addExpense(g, { description: "Dinner", amountMinor: 900, paidBy: "u1", participants: ["u1"] });
    deleteExpense(g, "exp_1");
    expect(g.expenses).toHaveLength(1);
    expect(g.expenses[0].deletedAt).toBeTruthy();
  });

  it("refuses to delete twice or to delete what does not exist", () => {
    const g = group();
    addExpense(g, { description: "Dinner", amountMinor: 900, paidBy: "u1", participants: ["u1"] });
    deleteExpense(g, "exp_1");
    expect(() => deleteExpense(g, "exp_1")).toThrow("already deleted");
    expect(() => deleteExpense(g, "exp_9")).toThrow("Expense not found");
  });
});

describe("updateExpense", () => {
  it("changes the description and category", () => {
    const g = group();
    addExpense(g, { description: "Dinner", amountMinor: 900, paidBy: "u1", participants: ["u1", "u2", "u3"] });
    const updated = updateExpense(g, "exp_1", { description: "  Team dinner ", category: "Food" });
    expect(updated.description).toBe("Team dinner");
    expect(updated.category).toBe("food");
  });

  it("re-splits an equal expense when the amount changes", () => {
    const g = group();
    addExpense(g, { description: "Dinner", amountMinor: 900, paidBy: "u1", participants: ["u1", "u2", "u3"] });
    updateExpense(g, "exp_1", { amountMinor: 1200 });
    const b = computeBalances(g);
    expect(b.u1).toBe(800);
    expect(b.u2).toBe(-400);
    assertBalanced(b);
  });

  it("refuses to edit a deleted expense or to set a negative amount", () => {
    const g = group();
    addExpense(g, { description: "Dinner", amountMinor: 900, paidBy: "u1", participants: ["u1"] });
    expect(() => updateExpense(g, "exp_1", { amountMinor: -5 })).toThrow(ValidationError);
    deleteExpense(g, "exp_1");
    expect(() => updateExpense(g, "exp_1", { description: "x" })).toThrow("deleted expense cannot be edited");
  });
});

describe("members", () => {
  it("adds a member with a fresh id", () => {
    const g = group();
    addMember(g, { id: "u4", name: " D " });
    expect(g.members.at(-1)).toEqual({ id: "u4", name: "D" });
    expect(() => addMember(g, { id: "u4", name: "Again" })).toThrow("already in this group");
  });

  it("will not remove a member who still owes or is owed", () => {
    const g = group();
    recordPayment(g, { from: "u2", to: "u1", amountMinor: 500 });
    expect(() => removeMember(g, "u2")).toThrow("Settle this member's balance");
    expect(() => removeMember(g, "u1")).toThrow("Settle this member's balance");
  });

  it("removes a member who was never part of an expense", () => {
    const g = group();
    addExpense(g, { description: "Dinner", amountMinor: 600, paidBy: "u1", participants: ["u1", "u2"] });
    removeMember(g, "u3");
    expect(g.members.map((m) => m.id)).toEqual(["u1", "u2"]);
    assertBalanced(computeBalances(g));
  });

  it("will not remove someone who is not in the group", () => {
    expect(() => removeMember(group(), "zz")).toThrow("not in this group");
  });
});
