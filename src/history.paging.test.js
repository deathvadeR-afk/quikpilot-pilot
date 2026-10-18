import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

function twelveExpenses() {
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
  it("[QP-QUIKSPL-284-1] Page 1 of 12 expenses with page size 10 shows at most 10 expenses", () => {
    const result = listExpenses(twelveExpenses(), { page: 1, pageSize: 10 });
    expect(result.items.length).toBe(10);
  });

  it("[QP-QUIKSPL-284-2] Expenses do not repeat between page 1 and page 2", () => {
    const g = twelveExpenses();
    const page1 = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.id);
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.id);
    const overlap = page1.filter((id) => page2.includes(id));
    expect(overlap).toEqual([]);
  });

  it("[QP-QUIKSPL-284-3] All expenses appear exactly once across pages", () => {
    const g = twelveExpenses();
    const all = [];
    for (const page of [1, 2]) {
      all.push(...listExpenses(g, { page, pageSize: 10 }).items.map((e) => e.id));
    }
    expect(all.length).toBe(12);
    expect(new Set(all).size).toBe(12);
  });
});
