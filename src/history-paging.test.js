import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

function twelve() {
  const g = createGroup("g12", "Twelve", [
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
  it("[QP-QUIKSPL-397-1] Page 1 of 12 expenses at page size 10 holds exactly 10 expenses", () => {
    const result = listExpenses(twelve(), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-397-2] Page 2 of 12 expenses at page size 10 holds the remaining 2 expenses", () => {
    const result = listExpenses(twelve(), { page: 2, pageSize: 10 });
    expect(result.items).toHaveLength(2);
  });

  it("[QP-QUIKSPL-397-3] No expense appears on both page 1 and page 2 of the reported case", () => {
    const g = twelve();
    const page1 = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.id);
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.id);
    expect(page1.filter((id) => page2.includes(id))).toEqual([]);
  });

  it("[QP-QUIKSPL-397-4] Each page holds at most the page size across several pages", () => {
    const g = twelve();
    const sizes = [1, 2, 3].map((page) => listExpenses(g, { page, pageSize: 5 }).items.length);
    expect(sizes).toEqual([5, 5, 2]);
  });
});
