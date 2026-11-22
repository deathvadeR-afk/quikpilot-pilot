import { describe, it, expect } from "vitest";
import { addExpense, createGroup, deleteExpense } from "./ledger.js";
import { listExpenses, MAX_PAGE_SIZE } from "./history.js";

function group() {
  const g = createGroup("g", "Test", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
    { id: "u3", name: "C" },
  ]);
  const add = (description, createdAt, extra = {}) =>
    addExpense(g, { description, amountMinor: 100, paidBy: "u1", participants: ["u1", "u2"], category: "food", createdAt, ...extra });
  add("First", "2026-10-01T09:00:00.000Z");
  add("Second", "2026-10-02T09:00:00.000Z", { category: "travel" });
  add("Third", "2026-10-03T09:00:00.000Z", { paidBy: "u3", participants: ["u3"] });
  return g;
}

describe("listExpenses", () => {
  it("lists newest first with the total", () => {
    const result = listExpenses(group());
    expect(result.items.map((e) => e.description)).toEqual(["Third", "Second", "First"]);
    expect(result.total).toBe(3);
    expect(result.page).toBe(1);
    expect(result.hasMore).toBe(false);
  });

  it("leaves out deleted expenses", () => {
    const g = group();
    deleteExpense(g, "exp_2");
    expect(listExpenses(g).items.map((e) => e.description)).toEqual(["Third", "First"]);
  });

  it("filters to a member who paid or took part", () => {
    const result = listExpenses(group(), { memberId: "u2" });
    expect(result.items.map((e) => e.description)).toEqual(["Second", "First"]);
  });

  it("filters by category", () => {
    expect(listExpenses(group(), { category: "travel" }).items.map((e) => e.description)).toEqual(["Second"]);
  });

  it("filters from a moment, inclusive", () => {
    const result = listExpenses(group(), { from: "2026-10-02T09:00:00.000Z" });
    expect(result.items.map((e) => e.description)).toEqual(["Third", "Second"]);
  });

  it("filters up to a full timestamp, inclusive", () => {
    const result = listExpenses(group(), { to: "2026-10-02T09:00:00.000Z" });
    expect(result.items.map((e) => e.description)).toEqual(["Second", "First"]);
  });

  it("combines filters", () => {
    const result = listExpenses(group(), { memberId: "u1", category: "food", from: "2026-10-01T00:00:00.000Z" });
    expect(result.items.map((e) => e.description)).toEqual(["First"]);
  });

  it("clamps the page size and page number to sensible values", () => {
    const result = listExpenses(group(), { page: -4, pageSize: 100000 });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(MAX_PAGE_SIZE);
  });

  it("falls back to a page size of 10", () => {
    expect(listExpenses(group()).pageSize).toBe(10);
  });

  it("[QP-QUIKSPL-160-1] Displays correct number of items on pages when total is exact multiple of page size", () => {
    const g = group();
    for (let i = 0; i < 17; i++) {
      addExpense(g, { description: `Item ${i + 4}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-${String(i + 4).padStart(2, '0')}T09:00:00.000Z` });
    }
    // Total 20 items, page size 10
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    expect(page1.items.length).toBe(10);
    expect(page1.total).toBe(20);
    expect(page1.hasMore).toBe(true);

    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    expect(page2.items.length).toBe(10);
    expect(page2.total).toBe(20);
    expect(page2.hasMore).toBe(false);

    const allItems = [...page1.items, ...page2.items];
    const uniqueItems = new Set(allItems.map(item => item.description));
    expect(uniqueItems.size).toBe(20);
  });

  it("[QP-QUIKSPL-160-2] Displays correct number of items on pages when total is not exact multiple of page size", () => {
    const g = group();
    for (let i = 0; i < 9; i++) {
      addExpense(g, { description: `Item ${i + 4}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-${String(i + 4).padStart(2, '0')}T09:00:00.000Z` });
    }
    // Total 12 items, page size 10
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    expect(page1.items.length).toBe(10);
    expect(page1.total).toBe(12);
    expect(page1.hasMore).toBe(true);

    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    expect(page2.items.length).toBe(2);
    expect(page2.total).toBe(12);
    expect(page2.hasMore).toBe(false);

    const allItems = [...page1.items, ...page2.items];
    const uniqueItems = new Set(allItems.map(item => item.description));
    expect(uniqueItems.size).toBe(12);
  });

  it("[QP-QUIKSPL-160-3] Handles a single page when total items are less than page size", () => {
    const g = group();
    // Total 3 items, page size 10 (default)
    const result = listExpenses(g, { page: 1, pageSize: 10 });
    expect(result.items.length).toBe(3);
    expect(result.total).toBe(3);
    expect(result.hasMore).toBe(false);
  });

  it("[QP-QUIKSPL-160-4] Ensures no item is repeated across pages", () => {
    const g = group();
    for (let i = 0; i < 9; i++) {
      addExpense(g, { description: `Item ${i + 4}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-${String(i + 4).padStart(2, '0')}T09:00:00.000Z` });
    }
    // Total 12 items, page size 10
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    const page2 = listExpenses(g, { page: 2, pageSize: 10 });

    const page1Descriptions = page1.items.map(item => item.description);
    const page2Descriptions = page2.items.map(item => item.description);

    page1Descriptions.forEach(desc => {
      expect(page2Descriptions).not.toContain(desc);
    });
  });
});
