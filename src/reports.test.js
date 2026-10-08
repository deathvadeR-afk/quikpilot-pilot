import { describe, it, expect } from "vitest";
import { addExpense, createGroup, recordPayment, deleteExpense } from "./ledger.js";
import { categoryTotals, memberSummary } from "./reports.js";

function group() {
  const g = createGroup("g", "Test", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
  ]);
  addExpense(g, { description: "Lunch", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
  addExpense(g, { description: "Dinner", amountMinor: 3000, paidBy: "u2", participants: ["u1", "u2"], category: "food" });
  addExpense(g, { description: "Bus", amountMinor: 500, paidBy: "u1", participants: ["u1", "u2"], category: "travel" });
  return g;
}

describe("categoryTotals", () => {
  it("adds up spend per category, largest first", () => {
    expect(categoryTotals(group())).toEqual([
      { category: "food", totalMinor: 4000 },
      { category: "travel", totalMinor: 500 },
    ]);
  });

  it("files an expense with no category under other", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    addExpense(g, { description: "Old", amountMinor: 700, paidBy: "u1", participants: ["u1"] });
    expect(categoryTotals(g)).toEqual([{ category: "other", totalMinor: 700 }]);
  });

  it("[QP-QUIKSPL-102-1] Excludes deleted expense from category total", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Dinner", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    const deletedExp = addExpense(g, { description: "Lunch", amountMinor: 500, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    deleteExpense(g, deletedExp.id);
    expect(categoryTotals(g)).toEqual([{ category: "food", totalMinor: 1000 }]);
  });

  it("[QP-QUIKSPL-102-5] Correctly calculates Goa trip food total after deletion", () => {
    const g = createGroup("Goa trip", "Goa", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Dinner", amountMinor: 486050, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    const deletedExp = addExpense(g, { description: "Duplicate Dinner", amountMinor: 486000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    deleteExpense(g, deletedExp.id);
    addExpense(g, { description: "Breakfast", amountMinor: 44700, paidBy: "u2", participants: ["u1", "u2"], category: "food" });
    expect(categoryTotals(g)).toEqual([{ category: "food", totalMinor: 486050 + 44700 }]);
  });

  it("[QP-QUIKSPL-102-6] Handles multiple deleted expenses in a category", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Dinner", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    const deletedExp1 = addExpense(g, { description: "Lunch", amountMinor: 500, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    const deletedExp2 = addExpense(g, { description: "Snacks", amountMinor: 200, paidBy: "u2", participants: ["u1", "u2"], category: "food" });
    deleteExpense(g, deletedExp1.id);
    deleteExpense(g, deletedExp2.id);
    expect(categoryTotals(g)).toEqual([{ category: "food", totalMinor: 1000 }]);
  });
});

describe("memberSummary", () => {
  it("reports what each member paid and what their share came to", () => {
    const rows = memberSummary(group());
    const a = rows.find((r) => r.id === "u1");
    const b = rows.find((r) => r.id === "u2");
    expect(a).toMatchObject({ paidMinor: 1500, owedMinor: 2250 });
    expect(b).toMatchObject({ paidMinor: 3000, owedMinor: 2250 });
  });

  it("includes the balance after payments between members", () => {
    const g = group();
    recordPayment(g, { from: "u1", to: "u2", amountMinor: 500 });
    const a = memberSummary(g).find((r) => r.id === "u1");
    expect(a.balanceMinor).toBe(-750 + 500);
  });

  it("[QP-QUIKSPL-102-2] Excludes deleted expense from payer's 'Paid' amount", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    const paidExp = addExpense(g, { description: "Dinner", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    const deletedExp = addExpense(g, { description: "Lunch", amountMinor: 500, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    deleteExpense(g, deletedExp.id);
    const a = memberSummary(g).find((r) => r.id === "u1");
    expect(a.paidMinor).toBe(paidExp.amountMinor);
  });

  it("[QP-QUIKSPL-102-3] Excludes deleted expense from sharer's 'Share' amount", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Dinner", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    const deletedExp = addExpense(g, { description: "Lunch", amountMinor: 500, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    deleteExpense(g, deletedExp.id);
    const a = memberSummary(g).find((r) => r.id === "u1");
    const b = memberSummary(g).find((r) => r.id === "u2");
    expect(a.owedMinor).toBe(500);
    expect(b.owedMinor).toBe(500);
  });

  it("[QP-QUIKSPL-102-4] Maintains balance consistency after deletion", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    const exp1 = addExpense(g, { description: "Dinner", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    const exp2 = addExpense(g, { description: "Lunch", amountMinor: 500, paidBy: "u2", participants: ["u1", "u2"], category: "food" });
    deleteExpense(g, exp2.id);
    const a = memberSummary(g).find((r) => r.id === "u1");
    const b = memberSummary(g).find((r) => r.id === "u2");
    expect(a.balanceMinor).toBe(a.paidMinor - a.owedMinor);
    expect(b.balanceMinor).toBe(b.paidMinor - b.owedMinor);
    expect(a.balanceMinor).toBe(500);
    expect(b.balanceMinor).toBe(-500);
  });

  it("[QP-QUIKSPL-102-7] Handles deleted expenses with partial shares", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
      { id: "u3", name: "C" },
    ]);
    addExpense(g, { description: "Dinner", amountMinor: 600, paidBy: "u1", participants: ["u1", "u2", "u3"] });
    const deletedExp = addExpense(g, { description: "Drinks", amountMinor: 300, paidBy: "u1", participants: ["u1", "u2"], shares: [200, 100] });
    deleteExpense(g, deletedExp.id);
    const a = memberSummary(g).find((r) => r.id === "u1");
    const b = memberSummary(g).find((r) => r.id === "u2");
    const c = memberSummary(g).find((r) => r.id === "u3");
    expect(a.owedMinor).toBe(200);
    expect(b.owedMinor).toBe(200);
    expect(c.owedMinor).toBe(200);
  });
});
