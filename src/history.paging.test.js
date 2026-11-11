import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

function bigGroup() {
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
  it("[QP-QUIKSPL-390-1] Page 1 holds exactly the page size when more expenses exist", () => {
    const result = listExpenses(bigGroup(), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
    expect(result.total).toBe(12);
    expect(result.hasMore).toBe(true);
  });

  it("[QP-QUIKSPL-390-2] Page 2 shows only the expenses not on page 1", () => {
    const g = bigGroup();
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    expect(page2.items).toHaveLength(2);
    const page1Ids = page1.items.map((e) => e.id);
    for (const e of page2.items) {
      expect(page1Ids).not.toContain(e.id);
    }
  });

  it("[QP-QUIKSPL-390-3] Paging through all pages returns every expense exactly once", () => {
    const g = bigGroup();
    const seen = [];
    let last = null;
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= 10) {
      last = listExpenses(g, { page, pageSize: 10 });
      seen.push(...last.items.map((e) => e.id));
      hasMore = last.hasMore;
      page += 1;
    }
    expect(seen).toHaveLength(12);
    expect(new Set(seen).size).toBe(12);
    expect(last.hasMore).toBe(false);
  });
});
