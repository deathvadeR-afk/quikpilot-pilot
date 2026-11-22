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

  it("[QP-QUIKSPL-170-1] Displays exactly page size items on the first page when total items exceed page size", () => {
    const g = group();
    for (let i = 0; i < 9; i++) {
      addExpense(g, { description: `Extra ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-0${4 + i}T09:00:00.000Z` });
    }
    // Total 3 existing + 9 new = 12 items
    const result = listExpenses(g, { page: 1, pageSize: 10 });
    expect(result.items.length).toBe(10);
    expect(new Set(result.items.map(e => e.id)).size).toBe(10);
    expect(result.total).toBe(12);
    expect(result.hasMore).toBe(true);
  });

  it("[QP-QUIKSPL-170-2] Displays remaining items on subsequent pages without duplication", () => {
    const g = group();
    for (let i = 0; i < 9; i++) {
      addExpense(g, { description: `Extra ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-0${4 + i}T09:00:00.000Z` });
    }
    // Total 12 items
    const firstPage = listExpenses(g, { page: 1, pageSize: 10 });
    const secondPage = listExpenses(g, { page: 2, pageSize: 10 });

    expect(secondPage.items.length).toBe(2);
    expect(new Set(secondPage.items.map(e => e.id)).size).toBe(2);
    const firstPageIds = new Set(firstPage.items.map(e => e.id));
    const secondPageIds = new Set(secondPage.items.map(e => e.id));
    secondPageIds.forEach(id => expect(firstPageIds.has(id)).toBe(false));
    expect(secondPage.total).toBe(12);
    expect(secondPage.hasMore).toBe(false);
  });

  it("[QP-QUIKSPL-170-3] Handles an empty expense list correctly", () => {
    const g = createGroup("empty", "Empty Group", []);
    const result = listExpenses(g, { page: 1, pageSize: 10 });
    expect(result.items.length).toBe(0);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it("[QP-QUIKSPL-170-4] Handles an expense list with fewer items than page size on the first page", () => {
    const g = group(); // Has 3 items
    const result = listExpenses(g, { page: 1, pageSize: 10 });
    expect(result.items.length).toBe(3);
    expect(new Set(result.items.map(e => e.id)).size).toBe(3);
    expect(result.total).toBe(3);
    expect(result.hasMore).toBe(false);
  });

  it("[QP-QUIKSPL-170-5] Ensures no item is duplicated across pages with multiple pages", () => {
    const g = group();
    for (let i = 0; i < 22; i++) {
      addExpense(g, { description: `Extra ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-0${4 + i}T09:00:00.000Z` });
    }
    // Total 3 existing + 22 new = 25 items
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    const page3 = listExpenses(g, { page: 3, pageSize: 10 });

    expect(page1.items.length).toBe(10);
    expect(page2.items.length).toBe(10);
    expect(page3.items.length).toBe(5);

    const allItems = [...page1.items, ...page2.items, ...page3.items];
    expect(allItems.length).toBe(25);
    expect(new Set(allItems.map(e => e.id)).size).toBe(25);
    expect(page3.total).toBe(25);
    expect(page3.hasMore).toBe(false);
  });
});
