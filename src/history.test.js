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

  it("[QP-QUIKSPL-186-1] Displays 10 unique expenses on page 1 and 2 unique expenses on page 2 for 12 total expenses", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    for (let i = 1; i <= 12; i++) {
      addExpense(g, { description: `Expense ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-${i < 10 ? '0' + i : i}T09:00:00.000Z` });
    }

    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    expect(page1.items.length).toBe(10);
    expect(page1.items.map(e => e.description)).toEqual(["Expense 12", "Expense 11", "Expense 10", "Expense 9", "Expense 8", "Expense 7", "Expense 6", "Expense 5", "Expense 4", "Expense 3"]);
    expect(page1.hasMore).toBe(true);

    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    expect(page2.items.length).toBe(2);
    expect(page2.items.map(e => e.description)).toEqual(["Expense 2", "Expense 1"]);
    expect(page2.hasMore).toBe(false);
  });

  it("[QP-QUIKSPL-186-2] Displays all expenses on the first page when total is less than page size", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    for (let i = 1; i <= 5; i++) {
      addExpense(g, { description: `Expense ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-0${i}T09:00:00.000Z` });
    }

    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    expect(page1.items.length).toBe(5);
    expect(page1.items.map(e => e.description)).toEqual(["Expense 5", "Expense 4", "Expense 3", "Expense 2", "Expense 1"]);
    expect(page1.hasMore).toBe(false);
  });

  it("[QP-QUIKSPL-186-3] Displays correct number of unique expenses when total is an exact multiple of page size", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    for (let i = 1; i <= 20; i++) {
      addExpense(g, { description: `Expense ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-${i < 10 ? '0' + i : i}T09:00:00.000Z` });
    }

    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    expect(page1.items.length).toBe(10);
    expect(page1.items.map(e => e.description)).toEqual(["Expense 20", "Expense 19", "Expense 18", "Expense 17", "Expense 16", "Expense 15", "Expense 14", "Expense 13", "Expense 12", "Expense 11"]);
    expect(page1.hasMore).toBe(true);

    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    expect(page2.items.length).toBe(10);
    expect(page2.items.map(e => e.description)).toEqual(["Expense 10", "Expense 9", "Expense 8", "Expense 7", "Expense 6", "Expense 5", "Expense 4", "Expense 3", "Expense 2", "Expense 1"]);
    expect(page2.hasMore).toBe(false);
  });

  it("[QP-QUIKSPL-186-4] Ensures no duplication when total expenses slightly exceed page size", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    for (let i = 1; i <= 11; i++) {
      addExpense(g, { description: `Expense ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-${i < 10 ? '0' + i : i}T09:00:00.000Z` });
    }

    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    expect(page1.items.length).toBe(10);
    expect(page1.items.map(e => e.description)).toEqual(["Expense 11", "Expense 10", "Expense 9", "Expense 8", "Expense 7", "Expense 6", "Expense 5", "Expense 4", "Expense 3", "Expense 2"]);
    expect(page1.hasMore).toBe(true);

    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    expect(page2.items.length).toBe(1);
    expect(page2.items.map(e => e.description)).toEqual(["Expense 1"]);
    expect(page2.hasMore).toBe(false);
  });
});
