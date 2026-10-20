import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

function twelveExpenseGroup() {
  const g = createGroup("g2", "Paging", [
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
  it("[QP-QUIKSPL-300-1] Page 1 shows at most pageSize expenses", () => {
    const result = listExpenses(twelveExpenseGroup(), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-300-2] Page 2 shows only the expenses not on page 1", () => {
    const g = twelveExpenseGroup();
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    expect(page2.items).toHaveLength(2);
    const page1Ids = new Set(page1.items.map((e) => e.id));
    for (const e of page2.items) {
      expect(page1Ids.has(e.id)).toBe(false);
    }
  });

  it("[QP-QUIKSPL-300-3] No expense appears on two pages across the whole list", () => {
    const g = twelveExpenseGroup();
    const allIds = [];
    let page = 1;
    let result;
    do {
      result = listExpenses(g, { page, pageSize: 10 });
      allIds.push(...result.items.map((e) => e.id));
      page++;
    } while (result.hasMore && page <= 20);
    expect(allIds).toHaveLength(12);
    expect(new Set(allIds).size).toBe(12);
  });
});
