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

describe("listExpenses pagination", () => {
  it("[QP-QUIKSPL-368-1] returns exactly pageSize expenses on a full first page", () => {
    expect(listExpenses(twelveExpenses(), { page: 1, pageSize: 10 }).items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-368-2] returns the remaining expenses on the last page without padding", () => {
    expect(listExpenses(twelveExpenses(), { page: 2, pageSize: 10 }).items).toHaveLength(2);
  });

  it("[QP-QUIKSPL-368-3] does not repeat the 11th expense on page 2", () => {
    const g = twelveExpenses();
    const page1 = listExpenses(g, { page: 1, pageSize: 10 }).items;
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items;
    expect(page1).toHaveLength(10);
    expect(page2).toHaveLength(2);
    const seen = new Set(page1.map((e) => e.description));
    expect(page2.some((e) => seen.has(e.description))).toBe(false);
  });

  it("[QP-QUIKSPL-368-4] returns at most pageSize expenses for a smaller page size", () => {
    expect(listExpenses(twelveExpenses(), { page: 1, pageSize: 5 }).items).toHaveLength(5);
  });
});
