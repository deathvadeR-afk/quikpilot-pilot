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

  it("[QP-QUIKSPL-195-1] Displays correct number of items on first page with more than one full page of expenses", () => {
    const g = group();
    for (let i = 0; i < 9; i++) {
      addExpense(g, { description: `Extra ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "other", createdAt: `2026-10-0${4 + i}T09:00:00.000Z` });
    }
    // Total 12 expenses (3 initial + 9 extra)
    const result = listExpenses(g, { page: 1, pageSize: 10 });
    expect(result.items.length).toBe(10);
    const uniqueItems = new Set(result.items.map(item => item.id));
    expect(uniqueItems.size).toBe(10);
  });

  it("[QP-QUIKSPL-195-2] Displays correct number of items on second page with more than one full page of expenses", () => {
    const g = group();
    for (let i = 0; i < 9; i++) {
      addExpense(g, { description: `Extra ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "other", createdAt: `2026-10-0${4 + i}T09:00:00.000Z` });
    }
    // Total 12 expenses (3 initial + 9 extra)
    const resultPage1 = listExpenses(g, { page: 1, pageSize: 10 });
    const resultPage2 = listExpenses(g, { page: 2, pageSize: 10 });
    expect(resultPage2.items.length).toBe(2);
    const page1ItemIds = new Set(resultPage1.items.map(item => item.id));
    const page2ItemIds = new Set(resultPage2.items.map(item => item.id));
    page2ItemIds.forEach(id => expect(page1ItemIds.has(id)).toBe(false));
  });

  it("[QP-QUIKSPL-195-3] Displays all items on a single page when total items are less than page size", () => {
    const g = group(); // 3 expenses
    const result = listExpenses(g, { page: 1, pageSize: 10 });
    expect(result.items.length).toBe(3);
    const uniqueItems = new Set(result.items.map(item => item.id));
    expect(uniqueItems.size).toBe(3);
  });

  it("[QP-QUIKSPL-195-4] No duplication when total items are an exact multiple of page size", () => {
    const g = group();
    for (let i = 0; i < 17; i++) {
      addExpense(g, { description: `Extra ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "other", createdAt: `2026-10-0${4 + i}T09:00:00.000Z` });
    }
    // Total 20 expenses (3 initial + 17 extra)
    const resultPage1 = listExpenses(g, { page: 1, pageSize: 10 });
    const resultPage2 = listExpenses(g, { page: 2, pageSize: 10 });
    expect(resultPage1.items.length).toBe(10);
    expect(resultPage2.items.length).toBe(10);
    const page1ItemIds = new Set(resultPage1.items.map(item => item.id));
    const page2ItemIds = new Set(resultPage2.items.map(item => item.id));
    page2ItemIds.forEach(id => expect(page1ItemIds.has(id)).toBe(false));
  });
});
