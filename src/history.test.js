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

describe("listExpenses paging boundaries", () => {
  function build(n) {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    const base = Date.UTC(2026, 9, 1);
    for (let i = 1; i <= n; i++) {
      addExpense(g, {
        description: `E${i}`,
        amountMinor: 100,
        paidBy: "u1",
        participants: ["u1", "u2"],
        category: "food",
        createdAt: new Date(base + i * 3600000).toISOString(),
      });
    }
    return g;
  }

  it("[QP-QUIKSPL-307-1] Page 1 shows exactly 10 of 12 expenses when the page size is 10", () => {
    const page1 = listExpenses(build(12), { page: 1, pageSize: 10 });
    expect(page1.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-307-2] Page 2 shows the last 2 expenses and none repeats from page 1", () => {
    const g = build(12);
    const page1 = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.id);
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.id);
    expect(page2).toHaveLength(2);
    expect(page2.filter((id) => page1.includes(id))).toEqual([]);
  });

  it("[QP-QUIKSPL-307-3] No page shows more expenses than the page size", () => {
    const g = build(25);
    const sizes = [1, 2, 3].map((page) => listExpenses(g, { page, pageSize: 10 }).items.length);
    expect(sizes[0]).toBe(10);
    expect(sizes[1]).toBe(10);
    expect(sizes[2]).toBe(5);
  });

  it("[QP-QUIKSPL-307-4] The 11th expense does not repeat at the top of page 2", () => {
    const g = build(12);
    const page1 = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.id);
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.id);
    const all = [...page1, ...page2];
    expect(new Set(all).size).toBe(all.length);
  });

  it("[QP-QUIKSPL-307-5] Every expense appears exactly once across all pages", () => {
    const g = build(25);
    const all = [];
    for (const page of [1, 2, 3]) {
      all.push(...listExpenses(g, { page, pageSize: 10 }).items.map((e) => e.id));
    }
    expect(all).toHaveLength(25);
    expect(new Set(all).size).toBe(25);
  });

  it("[QP-QUIKSPL-307-6] A zero or negative page size is rejected", () => {
    const g = build(12);
    expect(() => listExpenses(g, { pageSize: 0 })).toThrow();
    expect(() => listExpenses(g, { pageSize: -5 })).toThrow();
  });
});
