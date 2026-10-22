import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

function expensesOnDays(count) {
  const g = createGroup("g", "Test", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
  ]);
  for (let i = 1; i <= count; i++) {
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
  it("[QP-QUIKSPL-315-1] Page 1 shows exactly pageSize expenses when there are more than pageSize", () => {
    const result = listExpenses(expensesOnDays(12), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-315-2] Expenses do not repeat across the first two pages", () => {
    const g = expensesOnDays(12);
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    expect(page2.items).toHaveLength(2);
    const ids1 = new Set(page1.items.map((e) => e.id));
    expect(page2.items.some((e) => ids1.has(e.id))).toBe(false);
  });

  it("[QP-QUIKSPL-315-3] Last partial page shows only the remaining expenses", () => {
    const g = expensesOnDays(13);
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    expect(page2.items).toHaveLength(3);
    const ids1 = new Set(page1.items.map((e) => e.id));
    expect(page2.items.some((e) => ids1.has(e.id))).toBe(false);
  });

  it("[QP-QUIKSPL-315-4] Exact multiple of page size produces no extra items on the final page", () => {
    const g = expensesOnDays(20);
    expect(listExpenses(g, { page: 2, pageSize: 10 }).items).toHaveLength(10);
    expect(listExpenses(g, { page: 3, pageSize: 10 }).items).toHaveLength(0);
  });
});
