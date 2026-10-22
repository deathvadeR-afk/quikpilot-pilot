import { describe, it, expect } from "vitest";
import { addExpense, createGroup, recordPayment } from "./ledger.js";
import { categoryTotals, memberSummary } from "./reports.js";
import { deleteExpense } from "./ledger.js";
import { getGroup } from "./store.js";

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

describe("deleted expenses", () => {
  function withDeletedDinner() {
    const g = group();
    const dinner = addExpense(g, { description: "Dinner again", amountMinor: 9000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    deleteExpense(g, dinner.id);
    return g;
  }

  it("[QP-QUIKSPL-318-1] Category totals exclude a deleted expense", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    const removed = addExpense(g, { description: "Deleted food", amountMinor: 50000, paidBy: "u1", participants: ["u1"], category: "food" });
    addExpense(g, { description: "Active food", amountMinor: 933050, paidBy: "u1", participants: ["u1"], category: "food" });
    deleteExpense(g, removed.id);
    expect(categoryTotals(g)).toEqual([{ category: "food", totalMinor: 933050 }]);
  });

  it("[QP-QUIKSPL-318-2] Member Paid and Share exclude a deleted expense", () => {
    const rows = memberSummary(withDeletedDinner());
    const a = rows.find((r) => r.id === "u1");
    const b = rows.find((r) => r.id === "u2");
    expect(a).toMatchObject({ paidMinor: 1500, owedMinor: 2250 });
    expect(b).toMatchObject({ paidMinor: 3000, owedMinor: 2250 });
  });

  it("[QP-QUIKSPL-318-3] Paid minus Share equals Balance after a deletion", () => {
    const rows = memberSummary(withDeletedDinner());
    for (const row of rows) {
      expect(row.paidMinor - row.owedMinor).toBe(row.balanceMinor);
    }
  });

  it("[QP-QUIKSPL-318-4] Goa trip food total leaves out the deleted duplicate dinner", () => {
    const food = categoryTotals(getGroup("g1")).find((r) => r.category === "food");
    expect(food.totalMinor).toBe(933050);
  });

  it("[QP-QUIKSPL-318-5] Active expenses still count after the change", () => {
    const g = group();
    expect(categoryTotals(g)).toEqual([
      { category: "food", totalMinor: 4000 },
      { category: "travel", totalMinor: 500 },
    ]);
    const rows = memberSummary(g);
    expect(rows.find((r) => r.id === "u1")).toMatchObject({ paidMinor: 1500, owedMinor: 2250, balanceMinor: -750 });
    expect(rows.find((r) => r.id === "u2")).toMatchObject({ paidMinor: 3000, owedMinor: 2250, balanceMinor: 750 });
  });
});
