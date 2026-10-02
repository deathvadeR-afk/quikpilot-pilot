import { describe, it, expect } from "vitest";
import { listExpenses, MAX_PAGE_SIZE } from "./history.js";
import { createGroup, addExpense } from "./ledger.js";

function groupWithExpenses(numExpenses) {
  const g = createGroup("g", "Test", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
  ]);
  for (let i = 1; i <= numExpenses; i++) {
    addExpense(g, {
      description: `Expense ${i}`,
      amountMinor: 100 * i,
      paidBy: "u1",
      participants: ["u1", "u2"],
      createdAt: `2026-10-01T10:00:00.${String(i).padStart(3, "0")}Z`,
    });
  }
  return g;
}

describe("listExpenses pagination", () => {
  it("[QP-QUIKSPL-33-1] Returns correct number of items for a partial last page", () => {
    const g = groupWithExpenses(12);
    const result = listExpenses(g, { pageSize: 10, page: 1 });
    expect(result.items).toHaveLength(10);
    expect(result.items[0].description).toBe("Expense 12");
    expect(result.items[9].description).toBe("Expense 3");
    expect(result.hasMore).toBe(true);
    expect(result.total).toBe(12);
  });

  it("[QP-QUIKSPL-33-2] Returns remaining items on the last page without duplication", () => {
    const g = groupWithExpenses(12);
    const result = listExpenses(g, { pageSize: 10, page: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.items[0].description).toBe("Expense 2");
    expect(result.items[1].description).toBe("Expense 1");
    expect(result.hasMore).toBe(false);
    expect(result.total).toBe(12);
  });

  it("[QP-QUIKSPL-33-3] Handles total items exactly matching page size", () => {
    const g = groupWithExpenses(20);
    const page2Result = listExpenses(g, { pageSize: 10, page: 2 });
    expect(page2Result.items).toHaveLength(10);
    expect(page2Result.items[0].description).toBe("Expense 10");
    expect(page2Result.items[9].description).toBe("Expense 1");
    expect(page2Result.hasMore).toBe(false);
    expect(page2Result.total).toBe(20);

    const page3Result = listExpenses(g, { pageSize: 10, page: 3 });
    expect(page3Result.items).toHaveLength(0);
    expect(page3Result.hasMore).toBe(false);
    expect(page3Result.total).toBe(20);
  });

  it("[QP-QUIKSPL-33-4] Handles total items less than page size", () => {
    const g = groupWithExpenses(5);
    const page1Result = listExpenses(g, { pageSize: 10, page: 1 });
    expect(page1Result.items).toHaveLength(5);
    expect(page1Result.items[0].description).toBe("Expense 5");
    expect(page1Result.items[4].description).toBe("Expense 1");
    expect(page1Result.hasMore).toBe(false);
    expect(page1Result.total).toBe(5);

    const page2Result = listExpenses(g, { pageSize: 10, page: 2 });
    expect(page2Result.items).toHaveLength(0);
    expect(page2Result.hasMore).toBe(false);
    expect(page2Result.total).toBe(5);
  });

  it("[QP-QUIKSPL-33-5] Respects default page size when not specified", () => {
    const g = groupWithExpenses(15);
    const result = listExpenses(g, { page: 1 });
    expect(result.items).toHaveLength(10);
    expect(result.items[0].description).toBe("Expense 15");
    expect(result.items[9].description).toBe("Expense 6");
    expect(result.pageSize).toBe(10);
    expect(result.hasMore).toBe(true);
    expect(result.total).toBe(15);
  });

  it("[QP-QUIKSPL-33-6] Respects page size cap when exceeding limit", () => {
    const g = groupWithExpenses(60);
    const result = listExpenses(g, { pageSize: 100, page: 1 });
    expect(result.items).toHaveLength(MAX_PAGE_SIZE);
    expect(result.items[0].description).toBe("Expense 60");
    expect(result.items[MAX_PAGE_SIZE - 1].description).toBe("Expense 11");
    expect(result.pageSize).toBe(MAX_PAGE_SIZE);
    expect(result.hasMore).toBe(true);
    expect(result.total).toBe(60);
  });
});
