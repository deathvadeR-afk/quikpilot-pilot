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

  it("[QP-QUIKSPL-224-1] Category totals exclude a deleted expense", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" }
    ]);
    addExpense(g, { description: "Lunch", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    const deletedExpense = addExpense(g, { description: "Dinner", amountMinor: 3000, paidBy: "u2", participants: ["u1", "u2"], category: "food" });
    addExpense(g, { description: "Bus", amountMinor: 500, paidBy: "u1", participants: ["u1", "u2"], category: "travel" });
    deleteExpense(g, deletedExpense.id);
    expect(categoryTotals(g)).toEqual([
      { category: "food", totalMinor: 1000 },
      { category: "travel", totalMinor: 500 }
    ]);
  });

  it("[QP-QUIKSPL-224-5] Category totals are correct when no expenses are deleted", () => {
    const g = group();
    expect(categoryTotals(g)).toEqual([
      { category: "food", totalMinor: 4000 },
      { category: "travel", totalMinor: 500 }
    ]);
  });

  it("[QP-QUIKSPL-224-4] Goa trip food total matches expected value after deletion", () => {
    const g = createGroup("goa", "Goa trip", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
      { id: "u3", name: "C" }
    ]);
    addExpense(g, { description: "Flight", amountMinor: 150000, paidBy: "u1", participants: ["u1", "u2", "u3"], category: "travel" });
    addExpense(g, { description: "Hotel", amountMinor: 200000, paidBy: "u2", participants: ["u1", "u2", "u3"], category: "accommodation" });
    addExpense(g, { description: "Dinner", amountMinor: 5000, paidBy: "u1", participants: ["u1", "u2", "u3"], category: "food" });
    const deletedFoodExpense = addExpense(g, { description: "Lunch", amountMinor: 1000, paidBy: "u3", participants: ["u1", "u2", "u3"], category: "food" });
    addExpense(g, { description: "Breakfast", amountMinor: 4330.50, paidBy: "u2", participants: ["u1", "u2", "u3"], category: "food" });
    deleteExpense(g, deletedFoodExpense.id);
    const totals = categoryTotals(g);
    const foodTotal = totals.find(t => t.category === "food");
    expect(foodTotal.totalMinor).toBe(9330.50);
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

  it("[QP-QUIKSPL-224-2] Member 'Paid' excludes a deleted expense", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" }
    ]);
    const expense1 = addExpense(g, { description: "Lunch", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    const expense2 = addExpense(g, { description: "Dinner", amountMinor: 3000, paidBy: "u2", participants: ["u1", "u2"], category: "food" });
    deleteExpense(g, expense1.id);
    const rows = memberSummary(g);
    const a = rows.find((r) => r.id === "u1");
    const b = rows.find((r) => r.id === "u2");
    expect(a.paidMinor).toBe(0);
    expect(b.paidMinor).toBe(3000);
  });

  it("[QP-QUIKSPL-224-3] Member 'Share' excludes a deleted expense", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" }
    ]);
    const expense1 = addExpense(g, { description: "Lunch", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    const expense2 = addExpense(g, { description: "Dinner", amountMinor: 3000, paidBy: "u2", participants: ["u1", "u2"], category: "food" });
    deleteExpense(g, expense1.id);
    const rows = memberSummary(g);
    const a = rows.find((r) => r.id === "u1");
    const b = rows.find((r) => r.id === "u2");
    expect(a.owedMinor).toBe(1500);
    expect(b.owedMinor).toBe(1500);
  });

  it("[QP-QUIKSPL-224-6] Member summary is correct when no expenses are deleted", () => {
    const g = group();
    const rows = memberSummary(g);
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
});
