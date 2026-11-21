import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

function twelveExpenses() {
  const g = createGroup("g", "Test", [
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

describe("listExpenses pagination", () => {
  it("[QP-QUIKSPL-375-1] page 1 returns exactly pageSize expenses when more exist", () => {
    const result = listExpenses(twelveExpenses(), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-375-2] page 2 returns the remaining expenses without repeating page 1", () => {
    const g = twelveExpenses();
    const page1 = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.description);
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.description);
    expect(page2).toHaveLength(2);
    for (const d of page2) expect(page1).not.toContain(d);
  });

  it("[QP-QUIKSPL-375-3] no page exceeds the page size and no expense repeats across pages", () => {
    const g = twelveExpenses();
    const sizes = [];
    const all = [];
    for (let p = 1; p <= 3; p++) {
      const items = listExpenses(g, { page: p, pageSize: 5 }).items.map((e) => e.description);
      sizes.push(items.length);
      all.push(...items);
    }
    expect(sizes).toEqual([5, 5, 2]);
    expect(new Set(all).size).toBe(all.length);
  });
});
