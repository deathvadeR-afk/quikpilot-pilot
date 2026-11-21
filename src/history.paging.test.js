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
      description: `E${i}`,
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
  it("[QP-QUIKSPL-353-1] Page 1 of 12 expenses at page size 10 shows exactly 10 expenses", () => {
    const result = listExpenses(twelveExpenses(), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-353-2] Page 2 of 12 expenses at page size 10 shows the last 2 expenses", () => {
    const g = twelveExpenses();
    const page1 = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.description);
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.description);
    expect(page2).toHaveLength(2);
    expect(page2.filter((d) => page1.includes(d))).toEqual([]);
  });

  it("[QP-QUIKSPL-353-3] Paging through all pages returns every expense once", () => {
    const g = twelveExpenses();
    const all = [
      ...listExpenses(g, { page: 1, pageSize: 10 }).items,
      ...listExpenses(g, { page: 2, pageSize: 10 }).items,
    ].map((e) => e.description);
    expect(all).toHaveLength(12);
    expect(new Set(all).size).toBe(12);
  });
});
