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

function makeGroup(n) {
  const g = createGroup("g", "Test", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
    { id: "u3", name: "C" },
  ]);
  for (let i = 1; i <= n; i++) {
    addExpense(g, {
      description: `Exp ${i}`,
      amountMinor: 100,
      paidBy: "u1",
      participants: ["u1", "u2"],
      category: "food",
      createdAt: `2026-10-${String(i).padStart(2, "0")}T09:00:00.000Z`,
    });
  }
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

  it("[QP-QUIKSPL-264-1] Page 1 with 12 expenses and pageSize 10 shows exactly 10 items", () => {
    const result = listExpenses(makeGroup(12), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-264-2] Page 2 with 12 expenses and pageSize 10 shows exactly 2 items", () => {
    const result = listExpenses(makeGroup(12), { page: 2, pageSize: 10 });
    expect(result.items).toHaveLength(2);
  });

  it("[QP-QUIKSPL-264-3] No expense is repeated across page 1 and page 2", () => {
    const g = makeGroup(12);
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    const ids1 = new Set(page1.items.map((e) => e.id));
    const ids2 = new Set(page2.items.map((e) => e.id));
    const overlap = [...ids1].filter((id) => ids2.has(id));
    expect(overlap).toHaveLength(0);
  });

  it("[QP-QUIKSPL-264-4] All 12 expenses are reachable across the pages with no omissions", () => {
    const g = makeGroup(12);
    const all = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const result = listExpenses(g, { page, pageSize: 10 });
      all.push(...result.items);
      hasMore = result.hasMore;
      page++;
    }
    expect(all).toHaveLength(12);
    const ids = all.map((e) => e.id);
    expect(new Set(ids).size).toBe(12);
  });

  it("[QP-QUIKSPL-264-5] Exact multiple of pageSize produces no extra empty page", () => {
    const g = makeGroup(20);
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    const page3 = listExpenses(g, { page: 3, pageSize: 10 });
    expect(page1.items).toHaveLength(10);
    expect(page2.items).toHaveLength(10);
    expect(page3.items).toHaveLength(0);
  });

  it("[QP-QUIKSPL-264-6] A single expense with pageSize 10 appears on page 1 only", () => {
    const g = makeGroup(1);
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    expect(page1.items).toHaveLength(1);
    expect(page2.items).toHaveLength(0);
  });
});
