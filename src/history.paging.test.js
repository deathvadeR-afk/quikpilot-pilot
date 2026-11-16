import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

function pagedGroup(count) {
  const g = createGroup("g", "Paged", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
  ]);
  const start = Date.UTC(2026, 9, 1);
  for (let i = 0; i < count; i++) {
    addExpense(g, {
      description: `Expense ${i + 1}`,
      amountMinor: 100,
      paidBy: "u1",
      participants: ["u1", "u2"],
      category: "food",
      createdAt: new Date(start + i * 3600000).toISOString(),
    });
  }
  return g;
}

describe("listExpenses paging", () => {
  it("[QP-QUIKSPL-404-1] Shows ten expenses on page one when twelve exist", () => {
    const result = listExpenses(pagedGroup(12), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-404-2] Shows at most pageSize expenses on a later full page", () => {
    const result = listExpenses(pagedGroup(25), { page: 2, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-404-3] Page two does not repeat any expense from page one", () => {
    const g = pagedGroup(12);
    const page1 = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.id);
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.id);
    const shared = page1.filter((id) => page2.includes(id));
    expect(shared).toEqual([]);
  });

  it("[QP-QUIKSPL-404-4] Page two shows the two expenses page one left out", () => {
    const g = pagedGroup(12);
    const page1 = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.id);
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.id);
    const all = g.expenses.map((e) => e.id);
    expect(page2).toHaveLength(2);
    expect([...page1, ...page2].sort()).toEqual([...all].sort());
  });
});
