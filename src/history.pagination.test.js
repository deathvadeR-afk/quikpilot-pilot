import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

function twelveExpenses() {
  const g = createGroup("big", "Big", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
  ]);
  for (let i = 1; i <= 12; i++) {
    addExpense(g, {
      description: `Expense ${i}`,
      amountMinor: 100,
      paidBy: "u1",
      participants: ["u1", "u2"],
      category: "food",
      createdAt: `2026-10-${String(i).padStart(2, "0")}T09:00:00.000Z`,
    });
  }
  return g;
}

describe("listExpenses paging", () => {
  it("[QP-QUIKSPL-413-1] Returns at most the page size on the first page", () => {
    const result = listExpenses(twelveExpenses(), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-413-2] Does not repeat an expense across the first two pages", () => {
    const g = twelveExpenses();
    const all = g.expenses.map((e) => e.description);
    const page1 = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.description);
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.description);
    const notOnPage1 = all.filter((d) => !page1.includes(d));
    expect(page2.slice().sort()).toEqual(notOnPage1.slice().sort());
    expect(page2.filter((d) => page1.includes(d))).toEqual([]);
  });
});
