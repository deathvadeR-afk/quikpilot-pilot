import { describe, it, expect } from "vitest";
import { addExpense, createGroup, deleteExpense } from "./ledger.js";
import { createGroup as createEmptyGroup } from "./ledger.js";
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

  it("[QP-QUIKSPL-176-1] Displays correct number of items on the first page with exact page size", () => {
    const g = group();
    for (let i = 0; i < 7; i++) {
      addExpense(g, { description: `Item ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"] });
    }
    const result = listExpenses(g, { page: 1, pageSize: 10 });
    expect(result.items.length).toBe(10);
    const uniqueItems = new Set(result.items.map(item => item.id));
    expect(uniqueItems.size).toBe(10);
  });

  it("[QP-QUIKSPL-176-2] Displays correct number of items on the first page with fewer than page size", () => {
    const g = group();
    const result = listExpenses(g, { page: 1, pageSize: 10 });
    expect(result.items.length).toBe(3);
    const uniqueItems = new Set(result.items.map(item => item.id));
    expect(uniqueItems.size).toBe(3);
  });

  it("[QP-QUIKSPL-176-3] Displays correct number of items on the first page with more than page size", () => {
    const g = group();
    for (let i = 0; i < 9; i++) {
      addExpense(g, { description: `Item ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"] });
    }
    const result = listExpenses(g, { page: 1, pageSize: 10 });
    expect(result.items.length).toBe(10);
    const uniqueItems = new Set(result.items.map(item => item.id));
    expect(uniqueItems.size).toBe(10);
  });

  it("[QP-QUIKSPL-176-4] Displays correct number of items on the second page with remaining items", () => {
    const g = group();
    for (let i = 0; i < 9; i++) {
      addExpense(g, { description: `Item ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"] });
    }
    const firstPage = listExpenses(g, { page: 1, pageSize: 10 });
    const secondPage = listExpenses(g, { page: 2, pageSize: 10 });
    expect(secondPage.items.length).toBe(2);
    const firstPageIds = new Set(firstPage.items.map(item => item.id));
    const secondPageIds = new Set(secondPage.items.map(item => item.id));
    secondPageIds.forEach(id => expect(firstPageIds.has(id)).toBe(false));
  });

  it("[QP-QUIKSPL-176-5] Ensures no item repetition across pages", () => {
    const g = group();
    for (let i = 0; i < 9; i++) {
      addExpense(g, { description: `Item ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"] });
    }
    const firstPage = listExpenses(g, { page: 1, pageSize: 10 });
    const secondPage = listExpenses(g, { page: 2, pageSize: 10 });
    const allItems = [...firstPage.items, ...secondPage.items];
    expect(allItems.length).toBe(12);
    const uniqueItems = new Set(allItems.map(item => item.id));
    expect(uniqueItems.size).toBe(12);
  });

  it("[QP-QUIKSPL-176-6] Handles empty expense list gracefully", () => {
    const g = createGroup("empty", "Empty Group", []);
    const result = listExpenses(g, { page: 1, pageSize: 10 });
    expect(result.items.length).toBe(0);
  });
});
