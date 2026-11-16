import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

function twelveExpenses() {
  const g = createGroup("g12", "Twelve", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
  ]);
  for (let i = 0; i < 12; i++) {
    addExpense(g, {
      description: `Expense ${i + 1}`,
      amountMinor: 100,
      paidBy: "u1",
      participants: ["u1", "u2"],
      category: "food",
      createdAt: `2026-10-${String(i + 1).padStart(2, "0")}T09:00:00.000Z`,
    });
  }
  return g;
}

describe("listExpenses paging across pages", () => {
  it("[QP-QUIKSPL-399-1] Page 1 holds 10 expenses when 12 exist and the page size is 10", () => {
    const result = listExpenses(twelveExpenses(), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-399-2] Page 2 holds the 2 expenses left over after page 1", () => {
    const g = twelveExpenses();
    const page1 = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.id);
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.id);
    expect(page2).toHaveLength(2);
    expect(page2.filter((id) => page1.includes(id))).toEqual([]);
  });

  it("[QP-QUIKSPL-399-3] No expense repeats across pages 1 and 2 of a 12-expense list", () => {
    const g = twelveExpenses();
    const ids = [
      ...listExpenses(g, { page: 1, pageSize: 10 }).items,
      ...listExpenses(g, { page: 2, pageSize: 10 }).items,
    ].map((e) => e.id);
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
  });
});
