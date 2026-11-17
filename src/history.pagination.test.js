import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

function groupOfTwelve() {
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
      createdAt: `2026-10-${String(i).padStart(2, "0")}T09:00:00.000Z`,
    });
  }
  return g;
}

describe("listExpenses page boundaries", () => {
  it("[QP-QUIKSPL-410-1] Returns exactly the page size on page 1 of 12 expenses", () => {
    const result = listExpenses(groupOfTwelve(), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-410-2] Returns the remaining two expenses on page 2", () => {
    const result = listExpenses(groupOfTwelve(), { page: 2, pageSize: 10 });
    expect(result.items).toHaveLength(2);
  });

  it("[QP-QUIKSPL-410-3] Does not repeat an expense across pages 1 and 2", () => {
    const g = groupOfTwelve();
    const ids = [
      ...listExpenses(g, { page: 1, pageSize: 10 }).items,
      ...listExpenses(g, { page: 2, pageSize: 10 }).items,
    ].map((e) => e.id);
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
  });

  it("[QP-QUIKSPL-410-4] Holds at most the page size on page 1 with a smaller page size", () => {
    const result = listExpenses(groupOfTwelve(), { page: 1, pageSize: 5 });
    expect(result.items).toHaveLength(5);
  });
});
