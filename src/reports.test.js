import { describe, it, expect } from "vitest";
import { addExpense, createGroup, recordPayment } from "./ledger.js";
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

  it("[QP-QUIKSPL-115-1] Category total excludes a deleted expense", () => {
    const g = group();
    addExpense(g, { id: "exp_4", description: "Deleted Food", amountMinor: 1000, paidBy: "u1", participants: ["u1"], category: "food" });
    g.expenses.find((e) => e.id === "exp_4").deletedAt = new Date().toISOString();
    expect(categoryTotals(g)).toEqual([
      { category: "food", totalMinor: 4000 },
      { category: "travel", totalMinor: 500 }
    ]);
  });

  it("[QP-QUIKSPL-115-2] Member 'Paid' amount excludes a deleted expense", () => {
    const g = group();
    addExpense(g, { id: "exp_4", description: "Deleted Paid", amountMinor: 1000, paidBy: "u1", participants: ["u1"] });
    g.expenses.find((e) => e.id === "exp_4").deletedAt = new Date().toISOString();
    const rows = memberSummary(g);
    const a = rows.find((r) => r.id === "u1");
    expect(a.paidMinor).toBe(1500);
  });

  it("[QP-QUIKSPL-115-3] Member 'Share' amount excludes a deleted expense", () => {
    const g = group();
    addExpense(g, { id: "exp_4", description: "Deleted Share", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    g.expenses.find((e) => e.id === "exp_4").deletedAt = new Date().toISOString();
    const rows = memberSummary(g);
    const a = rows.find((r) => r.id === "u1");
    expect(a.owedMinor).toBe(2250);
  });

  it("[QP-QUIKSPL-115-4] Member balance is accurate after excluding deleted expenses", () => {
    const g = group();
    addExpense(g, { id: "exp_4", description: "Deleted Balance", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    g.expenses.find((e) => e.id === "exp_4").deletedAt = new Date().toISOString();
    const rows = memberSummary(g);
    const a = rows.find((r) => r.id === "u1");
    const b = rows.find((r) => r.id === "u2");
    expect(a.balanceMinor).toBe(a.paidMinor - a.owedMinor);
    expect(b.balanceMinor).toBe(b.paidMinor - b.owedMinor);
  });

  it("[QP-QUIKSPL-115-5] Goa trip food total matches expected value", () => {
    const g = createGroup("g1", "Goa trip", [
      { id: "u1", name: "Aditi" },
      { id: "u2", name: "Bhavin" },
      { id: "u3", name: "Chirag" },
      { id: "u5", name: "Esha" }
    ]);
    addExpense(g, { description: "Seafood dinner", amountMinor: 486000, paidBy: "u2", participants: ["u1", "u2", "u3", "u5"], category: "food" });
    addExpense(g, { description: "Duplicate dinner entry", amountMinor: 486000, paidBy: "u2", participants: ["u1", "u2", "u3", "u5"], category: "food" });
    g.expenses.find((e) => e.description === "Duplicate dinner entry").deletedAt = new Date().toISOString();
    addExpense(g, { description: "Groceries", amountMinor: 235050, paidBy: "u2", participants: ["u1", "u2", "u3"], category: "food", splitType: "exact", splitDetails: { u1: 100000, u2: 85050, u3: 50000 } });
    addExpense(g, { description: "Breakfast", amountMinor: 88000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    addExpense(g, { description: "Lunch", amountMinor: 124000, paidBy: "u3", participants: ["u1", "u3", "u5"], category: "food" });

    const totals = categoryTotals(g);
    const foodTotal = totals.find((t) => t.category === "food");
    expect(foodTotal.totalMinor).toBe(933050);
  });

  it("[QP-QUIKSPL-115-6] Non-deleted expenses are correctly included in totals", () => {
    const g = group();
    addExpense(g, { description: "Active Food", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    const totals = categoryTotals(g);
    const foodTotal = totals.find((t) => t.category === "food");
    expect(foodTotal.totalMinor).toBe(5000);

    const rows = memberSummary(g);
    const a = rows.find((r) => r.id === "u1");
    const b = rows.find((r) => r.id === "u2");
    expect(a.paidMinor).toBe(2500);
    expect(a.owedMinor).toBe(2750);
    expect(b.paidMinor).toBe(3000);
    expect(b.owedMinor).toBe(2750);
  });
});
