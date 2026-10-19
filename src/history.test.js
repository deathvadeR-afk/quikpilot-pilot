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
  function twelveExpenses() {
    const g = createGroup("g", "Paging", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    for (let i = 1; i <= 12; i++) {
      addExpense(g, {
        description: `E${i}`,
        amountMinor: 100,
        paidBy: "u1",
        participants: ["u1", "u2"],
        category: "food",
        createdAt: `2026-10-${String(i).padStart(2, "0")}T09:00:00.000Z`,
      });
    }
    return g;
  }

  it("[QP-QUIKSPL-270-1] Page 1 of 12 expenses with page size 10 shows exactly 10 expenses", () => {
    const result = listExpenses(twelveExpenses(), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-270-2] Page 2 of 12 expenses shows only the expenses not on page 1", () => {
    const g = twelveExpenses();
    const page1Ids = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.id);
    const page2Ids = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.id);
    expect(page2Ids).toHaveLength(2);
    expect(page2Ids.filter((id) => page1Ids.includes(id))).toEqual([]);
    expect(new Set([...page1Ids, ...page2Ids]).size).toBe(12);
  });

  it("[QP-QUIKSPL-270-3] No expense appears on two pages when the list is paged through in full", () => {
    const g = twelveExpenses();
    const seen = [];
    let page = 1;
    let result;
    do {
      result = listExpenses(g, { page, pageSize: 10 });
      seen.push(...result.items.map((e) => e.id));
      page++;
    } while (result.hasMore && page <= 20);
    expect(seen).toHaveLength(12);
    expect(new Set(seen).size).toBe(12);
  });

  it("[QP-QUIKSPL-270-4] Last page reports no more pages when it holds fewer than the page size", () => {
    const result = listExpenses(twelveExpenses(), { page: 2, pageSize: 10 });
    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(false);
  });
});
