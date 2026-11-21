import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

function groupWithExpenses(count) {
  const g = createGroup("g", "Test", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
  ]);
  for (let i = 0; i < count; i++) {
    addExpense(g, {
      description: "Expense " + (i + 1),
      amountMinor: 100,
      paidBy: "u1",
      participants: ["u1", "u2"],
      category: "food",
      createdAt: new Date(Date.UTC(2026, 9, 1) + i * 3600000).toISOString(),
    });
  }
  return g;
}

describe("listExpenses paging", () => {
  it("[QP-QUIKSPL-418-7] Returns a full first page of exactly the page size when more expenses remain", () => {
    const result = listExpenses(groupWithExpenses(12), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-418-8] Returns a full middle page of exactly the page size", () => {
    const result = listExpenses(groupWithExpenses(25), { page: 2, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-418-9] Returns only the remaining expenses on the final partial page", () => {
    const result = listExpenses(groupWithExpenses(12), { page: 2, pageSize: 10 });
    expect(result.items).toHaveLength(2);
  });

  it("[QP-QUIKSPL-418-10] No expense appears on two adjacent pages", () => {
    const g = groupWithExpenses(12);
    const firstIds = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.id);
    const secondIds = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.id);
    const shared = firstIds.filter((id) => secondIds.includes(id));
    expect(shared).toEqual([]);
    expect(new Set([...firstIds, ...secondIds]).size).toBe(12);
  });
});
