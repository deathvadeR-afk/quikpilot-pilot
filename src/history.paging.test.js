import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

function twelveExpenses() {
  const g = createGroup("g", "Paging", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
  ]);
  for (let i = 1; i <= 12; i++) {
    addExpense(g, {
      description: `Item ${i}`,
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
  it("[QP-QUIKSPL-421-1] page 1 of 12 expenses at page size 10 returns 10 items", () => {
    const result = listExpenses(twelveExpenses(), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-421-2] page 2 of 12 expenses at page size 10 returns the last 2 expenses", () => {
    const result = listExpenses(twelveExpenses(), { page: 2, pageSize: 10 });
    expect(result.items).toHaveLength(2);
  });

  it("[QP-QUIKSPL-421-3] pages 1 and 2 together show 12 distinct expenses with no overlap", () => {
    const g = twelveExpenses();
    const page1 = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.id);
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.id);
    const all = [...page1, ...page2];
    expect(all).toHaveLength(12);
    expect(new Set(all).size).toBe(12);
  });
});
