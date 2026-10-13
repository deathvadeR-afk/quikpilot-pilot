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

  it("[QP-QUIKSPL-174-1] Displays correct number of items on first page with overflow", () => {
    const g = group();
    for (let i = 0; i < 9; i++) {
      addExpense(g, { description: `Item ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-0${4 + i}T09:00:00.000Z` });
    }
    const result = listExpenses(g, { page: 1, pageSize: 10 });
    expect(result.items.length).toBe(10);
    expect(new Set(result.items.map(e => e.description)).size).toBe(10);
  });

  it("[QP-QUIKSPL-174-2] Displays correct number of items on subsequent page with remainder", () => {
    const g = group();
    for (let i = 0; i < 9; i++) {
      addExpense(g, { description: `Item ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-0${4 + i}T09:00:00.000Z` });
    }
    const result = listExpenses(g, { page: 2, pageSize: 10 });
    expect(result.items.length).toBe(2);
    expect(new Set(result.items.map(e => e.description)).size).toBe(2);
  });

  it("[QP-QUIKSPL-174-3] Ensures no item duplication across pages", () => {
    const g = group();
    for (let i = 0; i < 9; i++) {
      addExpense(g, { description: `Item ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-0${4 + i}T09:00:00.000Z` });
    }
    const page1 = listExpenses(g, { page: 1, pageSize: 10 }).items.map(e => e.description);
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items.map(e => e.description);
    const allItems = [...page1, ...page2];
    expect(page1.length).toBe(10);
    expect(page2.length).toBe(2);
    expect(new Set(allItems).size).toBe(12);
  });

  it("[QP-QUIKSPL-174-4] Displays full page when total items is exact multiple of page size", () => {
    const g = group();
    for (let i = 0; i < 17; i++) {
      addExpense(g, { description: `Item ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-0${4 + i}T09:00:00.000Z` });
    }
    const result = listExpenses(g, { page: 1, pageSize: 10 });
    expect(result.items.length).toBe(10);
    expect(new Set(result.items.map(e => e.description)).size).toBe(10);
  });

  it("[QP-QUIKSPL-174-5] Displays empty page when no items remain", () => {
    const g = group();
    for (let i = 0; i < 7; i++) {
      addExpense(g, { description: `Item ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-0${4 + i}T09:00:00.000Z` });
    }
    const result = listExpenses(g, { page: 2, pageSize: 10 });
    expect(result.items.length).toBe(0);
  });
});
