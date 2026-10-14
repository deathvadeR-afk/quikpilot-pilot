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

  it("[QP-QUIKSPL-188-1] Displays correct number of items on first page when total items exceed page size", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    for (let i = 0; i < 12; i++) {
      addExpense(g, { description: `Item ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-01T09:00:0${i}Z` });
    }
    const result = listExpenses(g, { page: 1, pageSize: 10 });
    expect(result.items.length).toBe(10);
    expect(result.total).toBe(12);
    expect(result.page).toBe(1);
    expect(result.hasMore).toBe(true);
  });

  it("[QP-QUIKSPL-188-2] Displays correct number of items on subsequent pages without duplication", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    for (let i = 0; i < 12; i++) {
      addExpense(g, { description: `Item ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-01T09:00:0${i}Z` });
    }
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    expect(page2.items.length).toBe(2);
    expect(page2.total).toBe(12);
    expect(page2.page).toBe(2);
    expect(page2.hasMore).toBe(false);
    const page1Descriptions = page1.items.map(e => e.description);
    const page2Descriptions = page2.items.map(e => e.description);
    page2Descriptions.forEach(desc => {
      expect(page1Descriptions).not.toContain(desc);
    });
  });

  it("[QP-QUIKSPL-188-3] Handles exact multiple of page size correctly", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    for (let i = 0; i < 20; i++) {
      addExpense(g, { description: `Item ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-01T09:00:0${i < 10 ? '0' + i : i}Z` });
    }
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    const page3 = listExpenses(g, { page: 3, pageSize: 10 });

    expect(page1.items.length).toBe(10);
    expect(page1.total).toBe(20);
    expect(page1.page).toBe(1);
    expect(page1.hasMore).toBe(true);

    expect(page2.items.length).toBe(10);
    expect(page2.total).toBe(20);
    expect(page2.page).toBe(2);
    expect(page2.hasMore).toBe(false);

    expect(page3.items.length).toBe(0);
    expect(page3.total).toBe(20);
    expect(page3.page).toBe(3);
    expect(page3.hasMore).toBe(false);

    const allItems = [...page1.items, ...page2.items];
    const uniqueItems = new Set(allItems.map(e => e.description));
    expect(uniqueItems.size).toBe(20);
  });

  it("[QP-QUIKSPL-188-4] Handles total items less than page size", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    for (let i = 0; i < 5; i++) {
      addExpense(g, { description: `Item ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-01T09:00:0${i}Z` });
    }
    const result = listExpenses(g, { page: 1, pageSize: 10 });
    expect(result.items.length).toBe(5);
    expect(result.total).toBe(5);
    expect(result.page).toBe(1);
    expect(result.hasMore).toBe(false);
  });

  it("[QP-QUIKSPL-188-5] Ensures no item repetition across pages with multiple pages", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    for (let i = 0; i < 12; i++) {
      addExpense(g, { description: `Item ${i}`, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: `2026-10-01T09:00:0${i}Z` });
    }
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    const page2 = listExpenses(g, { page: 2, pageSize: 10 });

    const page1Descriptions = page1.items.map(e => e.description);
    const page2Descriptions = page2.items.map(e => e.description);

    page1Descriptions.forEach(desc => {
      expect(page2Descriptions).not.toContain(desc);
    });
  });
});
