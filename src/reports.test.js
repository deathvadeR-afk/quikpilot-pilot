import { describe, it, expect } from "vitest";
import { addExpense, createGroup, recordPayment } from "./ledger.js";
import { categoryTotals, memberSummary } from "./reports.js";
import { deleteExpense } from "./ledger.js";

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
});

describe("Spending summary after a deletion", () => {
  function anaAndBen() {
    const g = createGroup("ab", "Ana and Ben", [
      { id: "ana", name: "Ana" },
      { id: "ben", name: "Ben" },
    ]);
    addExpense(g, { description: "Dinner", amountMinor: 10000, paidBy: "ana", participants: ["ana", "ben"], category: "food" });
    const dead = addExpense(g, { description: "Snacks", amountMinor: 6000, paidBy: "ana", participants: ["ana", "ben"], category: "food" });
    deleteExpense(g, dead.id);
    return g;
  }

  it("[QP-QUIKSPL-423-1] Goa trip food total leaves out a deleted food expense", () => {
    const g = createGroup("goa", "Goa trip", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Groceries", amountMinor: 900000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    addExpense(g, { description: "Dinner", amountMinor: 33050, paidBy: "u2", participants: ["u1", "u2"], category: "food" });
    const old = addExpense(g, { description: "Brunch", amountMinor: 120000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    deleteExpense(g, old.id);
    const food = categoryTotals(g).find((c) => c.category === "food");
    expect(food.totalMinor).toBe(933050);
  });

  it("[QP-QUIKSPL-423-2] Member Paid and Share leave out a deleted expense", () => {
    const ana = memberSummary(anaAndBen()).find((r) => r.id === "ana");
    expect(ana.paidMinor).toBe(10000);
    expect(ana.owedMinor).toBe(5000);
  });

  it("[QP-QUIKSPL-423-3] Paid minus Share matches Balance after a deletion", () => {
    const ana = memberSummary(anaAndBen()).find((r) => r.id === "ana");
    expect(ana.paidMinor - ana.owedMinor).toBe(ana.balanceMinor);
    expect(ana.balanceMinor).toBe(5000);
  });

  it("[QP-QUIKSPL-423-4] A category whose only expense was deleted is not shown", () => {
    const g = createGroup("trip", "Trip", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    const bus = addExpense(g, { description: "Bus", amountMinor: 500, paidBy: "u1", participants: ["u1", "u2"], category: "travel" });
    deleteExpense(g, bus.id);
    expect(categoryTotals(g).map((c) => c.category)).not.toContain("travel");
  });
});
