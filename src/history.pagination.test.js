import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

function bigGroup(count) {
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
      createdAt: `2026-10-01T09:${String(i).padStart(2, "0")}:00.000Z`,
    });
  }
  return g;
}

describe("listExpenses paging", () => {
  it("[QP-QUIKSPL-411-1] Page 1 of 12 expenses with page size 10 holds 10 expenses", () => {
    const result = listExpenses(bigGroup(12), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-411-2] Page 2 of 12 expenses with page size 10 holds the remaining 2 expenses", () => {
    const g = bigGroup(12);
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    expect(page2.items).toHaveLength(2);
    const firstPageIds = new Set(page1.items.map((e) => e.id));
    expect(page2.items.some((e) => firstPageIds.has(e.id))).toBe(false);
  });

  it("[QP-QUIKSPL-411-3] Pages of 25 expenses hold at most the page size and share no expense", () => {
    const g = bigGroup(25);
    const pages = [1, 2, 3].map((page) => listExpenses(g, { page, pageSize: 10 }).items);
    expect(pages.map((p) => p.length)).toEqual([10, 10, 5]);
    const ids = pages.flat().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
