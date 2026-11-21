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
      description: `Expense ${i}`,
      amountMinor: 100,
      paidBy: "u1",
      participants: ["u1", "u2"],
      category: "food",
      createdAt: new Date(Date.UTC(2026, 9, i)).toISOString(),
    });
  }
  return g;
}

describe("listExpenses pagination", () => {
  it("[QP-QUIKSPL-415-1] returns 10 expenses on page 1 when 12 exist and the page size is 10", () => {
    const result = listExpenses(twelveExpenses(), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-415-2] returns the remaining 2 expenses on page 2 when 12 exist and the page size is 10", () => {
    const result = listExpenses(twelveExpenses(), { page: 2, pageSize: 10 });
    expect(result.items).toHaveLength(2);
  });

  it("[QP-QUIKSPL-415-3] does not repeat any expense across page 1 and page 2 when 12 exist and the page size is 10", () => {
    const g = twelveExpenses();
    const first = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.id);
    const second = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.id);
    const all = [...first, ...second];
    expect(all).toHaveLength(12);
    expect(new Set(all).size).toBe(all.length);
  });
});
