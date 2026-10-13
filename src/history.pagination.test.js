import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

function createExpenseGroup(numItems) {
  const g = createGroup("g", "Test", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
  ]);
  for (let i = 1; i <= numItems; i++) {
    addExpense(g, {
      description: `Expense ${i}`,
      amountMinor: 100,
      paidBy: "u1",
      participants: ["u1", "u2"],
      category: "food",
      createdAt: `2026-10-${String(i).padStart(2, '0')}T09:00:00.000Z`,
    });
  }
  return g;
}

describe("listExpenses pagination", () => {
  it("[QP-QUIKSPL-138-1] Displays correct number of items on first page with overflow", () => {
    const g = createExpenseGroup(12);
    const result = listExpenses(g, { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
    expect(result.total).toBe(12);
    expect(result.page).toBe(1);
    expect(result.hasMore).toBe(true);
    expect(new Set(result.items.map(e => e.description)).size).toBe(10);
  });

  it("[QP-QUIKSPL-138-2] Displays remaining items on subsequent page without duplication", () => {
    const g = createExpenseGroup(12);
    const firstPage = listExpenses(g, { page: 1, pageSize: 10 });
    const secondPage = listExpenses(g, { page: 2, pageSize: 10 });
    expect(secondPage.items).toHaveLength(2);
    expect(secondPage.total).toBe(12);
    expect(secondPage.page).toBe(2);
    expect(secondPage.hasMore).toBe(false);
    const firstPageDescriptions = new Set(firstPage.items.map(e => e.description));
    secondPage.items.forEach(item => {
      expect(firstPageDescriptions.has(item.description)).toBe(false);
    });
    expect(new Set(secondPage.items.map(e => e.description)).size).toBe(2);
  });

  it("[QP-QUIKSPL-138-3] Displays full page when total items are exact multiple of page size", () => {
    const g = createExpenseGroup(20);
    const result = listExpenses(g, { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
    expect(result.total).toBe(20);
    expect(result.page).toBe(1);
    expect(result.hasMore).toBe(true);
    expect(new Set(result.items.map(e => e.description)).size).toBe(10);
  });

  it("[QP-QUIKSPL-138-4] Displays remaining items on last page when total items are exact multiple of page size", () => {
    const g = createExpenseGroup(20);
    const firstPage = listExpenses(g, { page: 1, pageSize: 10 });
    const secondPage = listExpenses(g, { page: 2, pageSize: 10 });
    expect(secondPage.items).toHaveLength(10);
    expect(secondPage.total).toBe(20);
    expect(secondPage.page).toBe(2);
    expect(secondPage.hasMore).toBe(false);
    const firstPageDescriptions = new Set(firstPage.items.map(e => e.description));
    secondPage.items.forEach(item => {
      expect(firstPageDescriptions.has(item.description)).toBe(false);
    });
    expect(new Set(secondPage.items.map(e => e.description)).size).toBe(10);
  });

  it("[QP-QUIKSPL-138-5] Displays all items on a single page if total is less than page size", () => {
    const g = createExpenseGroup(5);
    const result = listExpenses(g, { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(5);
    expect(result.total).toBe(5);
    expect(result.page).toBe(1);
    expect(result.hasMore).toBe(false);
    expect(new Set(result.items.map(e => e.description)).size).toBe(5);
  });
});
