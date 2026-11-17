import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

function groupOf(count) {
  const g = createGroup("g", "Paging", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
  ]);
  for (let i = 0; i < count; i++) {
    addExpense(g, {
      description: `Expense ${i + 1}`,
      amountMinor: 100,
      paidBy: "u1",
      participants: ["u1", "u2"],
      category: "food",
      createdAt: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(),
    });
  }
  return g;
}

describe("listExpenses paging", () => {
  it("[QP-QUIKSPL-409-1] page 1 of twelve expenses at page size ten shows ten expenses", () => {
    const result = listExpenses(groupOf(12), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-409-2] page 2 of twelve expenses shows the two expenses left over", () => {
    const result = listExpenses(groupOf(12), { page: 2, pageSize: 10 });
    expect(result.items).toHaveLength(2);
  });

  it("[QP-QUIKSPL-409-3] no expense appears on both page 1 and page 2 of twelve expenses", () => {
    const g = groupOf(12);
    const first = listExpenses(g, { page: 1, pageSize: 10 }).items;
    const second = listExpenses(g, { page: 2, pageSize: 10 }).items;
    const ids = [...first, ...second].map((e) => e.id);
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
  });

  it("[QP-QUIKSPL-409-4] a middle page of a longer list shows ten expenses, not eleven", () => {
    const result = listExpenses(groupOf(25), { page: 2, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });
});
