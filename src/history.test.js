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
});

function createExpenseList(count) {
  const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
  for (let i = 1; i <= count; i++) {
    addExpense(g, { description: `Expense ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-${String(i).padStart(2, '0')}T09:00:00.000Z` });
  }
  return g;
}

describe("listExpenses pagination", () => {
  it("[QP-QUIKSPL-159-1] Displays correct number of items on first page with overflow", () => {
    const g = createExpenseList(12);
    const result = listExpenses(g, { page: 1, pageSize: 10 });
    expect(result.items.length).toBe(10);
    expect(result.items.map(e => e.description)).toEqual(["Expense 12", "Expense 11", "Expense 10", "Expense 9", "Expense 8", "Expense 7", "Expense 6", "Expense 5", "Expense 4", "Expense 3"]);
    expect(result.hasMore).toBe(true);
  });

  it("[QP-QUIKSPL-159-2] Displays remaining items on subsequent page without duplication", () => {
    const g = createExpenseList(12);
    const firstPage = listExpenses(g, { page: 1, pageSize: 10 });
    const secondPage = listExpenses(g, { page: 2, pageSize: 10 });
    expect(secondPage.items.length).toBe(2);
    expect(secondPage.items.map(e => e.description)).toEqual(["Expense 2", "Expense 1"]);
    expect(secondPage.items.some(item => firstPage.items.includes(item))).toBe(false);
    expect(secondPage.hasMore).toBe(false);
  });

  it("[QP-QUIKSPL-159-3] Displays full page when total items are exact multiple of page size", () => {
    const g = createExpenseList(20);
    const result = listExpenses(g, { page: 1, pageSize: 10 });
    expect(result.items.length).toBe(10);
    expect(result.hasMore).toBe(true);
  });

  it("[QP-QUIKSPL-159-4] Displays remaining items on last page when total items are exact multiple of page size", () => {
    const g = createExpenseList(20);
    const firstPage = listExpenses(g, { page: 1, pageSize: 10 });
    const secondPage = listExpenses(g, { page: 2, pageSize: 10 });
    expect(secondPage.items.length).toBe(10);
    expect(secondPage.items.some(item => firstPage.items.includes(item))).toBe(false);
    expect(secondPage.hasMore).toBe(false);
  });

  it("[QP-QUIKSPL-159-5] Displays all items on a single page if total is less than page size", () => {
    const g = createExpenseList(5);
    const result = listExpenses(g, { page: 1, pageSize: 10 });
    expect(result.items.length).toBe(5);
    expect(result.items.map(e => e.description)).toEqual(["Expense 5", "Expense 4", "Expense 3", "Expense 2", "Expense 1"]);
    expect(result.hasMore).toBe(false);
  });
});
