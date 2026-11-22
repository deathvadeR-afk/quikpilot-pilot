import { describe, it, expect } from "vitest";
import { addExpense, createGroup, deleteExpense, isActive } from "./ledger.js";
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

  it("[QP-QUIKSPL-165-1] Displays correct number of unique items when total is not a multiple of page size", () => {
    const g = group();
    for (let i = 0; i < 9; i++) {
      addExpense(g, { description: `Extra ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-0${4 + i}T09:00:00.000Z` });
    }
    // Total 3 existing + 9 new = 12 expenses
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    expect(page1.items.length).toBe(10);
    expect(page1.total).toBe(12);
    expect(page1.hasMore).toBe(true);

    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    expect(page2.items.length).toBe(2);
    expect(page2.total).toBe(12);
    expect(page2.hasMore).toBe(false);

    const allItems = [...page1.items, ...page2.items];
    const uniqueItems = new Set(allItems.map(item => item.id));
    expect(uniqueItems.size).toBe(12);
  });

  it("[QP-QUIKSPL-165-2] Displays correct number of unique items when total is a multiple of page size", () => {
    const g = group();
    for (let i = 0; i < 17; i++) {
      addExpense(g, { description: `Extra ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-0${4 + i}T09:00:00.000Z` });
    }
    // Total 3 existing + 17 new = 20 expenses
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    expect(page1.items.length).toBe(10);
    expect(page1.total).toBe(20);
    expect(page1.hasMore).toBe(true);

    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    expect(page2.items.length).toBe(10);
    expect(page2.total).toBe(20);
    expect(page2.hasMore).toBe(false);

    const allItems = [...page1.items, ...page2.items];
    const uniqueItems = new Set(allItems.map(item => item.id));
    expect(uniqueItems.size).toBe(20);
  });

  it("[QP-QUIKSPL-165-3] Displays all items on a single page if total is less than page size", () => {
    const g = group(); // 3 expenses
    const result = listExpenses(g, { page: 1, pageSize: 10 });
    expect(result.items.length).toBe(3);
    expect(result.total).toBe(3);
    expect(result.hasMore).toBe(false);
  });

  it("[QP-QUIKSPL-165-4] Applies fix to the `listExpenses` function's query parameters", () => {
    const g = group();
    for (let i = 0; i < 17; i++) {
      addExpense(g, { description: `Extra ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-0${4 + i}T09:00:00.000Z` });
    }
    // Total 20 expenses
    const pageSize = 5;
    const pageNumber = 3;
    const expectedStart = (pageNumber - 1) * pageSize;
    const expectedEnd = expectedStart + pageSize;

    const result = listExpenses(g, { page: pageNumber, pageSize: pageSize });
    expect(result.items.length).toBe(pageSize);
    expect(result.total).toBe(20);
    expect(result.page).toBe(pageNumber);
    expect(result.pageSize).toBe(pageSize);

    // Verify the slice logic by checking the IDs of the items returned
    const allItems = g.expenses.filter(isActive).sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    const expectedItems = allItems.slice(expectedStart, expectedEnd);
    expect(result.items.map(item => item.id)).toEqual(expectedItems.map(item => item.id));
  });
});
