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

describe("listExpenses paging", () => {
  function groupWithExpenses(count) {
    const g = createGroup("g", "Paging", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    for (let i = 1; i <= count; i++) {
      addExpense(g, {
        description: `Expense ${i}`,
        amountMinor: 100,
        paidBy: "u1",
        participants: ["u1", "u2"],
        category: "food",
        createdAt: `2026-10-${String(i).padStart(2, "0")}T09:00:00.000Z`,
      });
    }
    return g;
  }

  it("[QP-QUIKSPL-419-1] returns a full first page of pageSize expenses", () => {
    const result = listExpenses(groupWithExpenses(12), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-419-2] does not repeat an expense on page 2 that appeared on page 1", () => {
    const g = groupWithExpenses(12);
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    expect(page2.items).toHaveLength(2);
    const page1Ids = new Set(page1.items.map((e) => e.id));
    expect(page2.items.some((e) => page1Ids.has(e.id))).toBe(false);
  });

  it("[QP-QUIKSPL-419-3] walking all pages never shows an expense twice", () => {
    const g = groupWithExpenses(12);
    const pageSizes = [];
    const seen = [];
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= 10) {
      const result = listExpenses(g, { page, pageSize: 5 });
      pageSizes.push(result.items.length);
      seen.push(...result.items.map((e) => e.id));
      hasMore = result.hasMore;
      page++;
    }
    expect(pageSizes).toEqual([5, 5, 2]);
    expect(seen).toHaveLength(12);
    expect(new Set(seen).size).toBe(12);
  });
});
