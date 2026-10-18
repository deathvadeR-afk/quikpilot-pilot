import { describe, it, expect } from "vitest";
import { addExpense, createGroup, deleteExpense } from "./ledger.js";
import { listExpenses, MAX_PAGE_SIZE } from "./history.js";
import { ValidationError } from "./validation.js";

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

  it("[QP-QUIKSPL-289-1] Page 1 shows exactly 10 expenses when 12 exist and the page size is 10", () => {
    const result = listExpenses(twelveExpenses(), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-289-2] Page 2 shows the remaining expenses without repeating any from page 1", () => {
    const g = twelveExpenses();
    const first = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.id);
    const second = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.id);
    expect(second).toHaveLength(2);
    expect(second.filter((id) => first.includes(id))).toEqual([]);
  });

  it("[QP-QUIKSPL-289-3] Pages together show each expense once when the page size is 5", () => {
    const g = twelveExpenses();
    const pages = [1, 2, 3].map((page) => listExpenses(g, { page, pageSize: 5 }).items);
    for (const items of pages) {
      expect(items.length).toBeLessThanOrEqual(5);
    }
    const ids = pages.flat().map((e) => e.id);
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
  });

  it("[QP-QUIKSPL-289-4] A page beyond the last returns no expenses", () => {
    const g = twelveExpenses();
    const first = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.id);
    const second = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.id);
    const third = listExpenses(g, { page: 3, pageSize: 10 }).items;
    expect(third).toHaveLength(0);
    const ids = [...first, ...second];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("[QP-QUIKSPL-289-5] A non-positive or non-numeric page size is rejected", () => {
    const g = twelveExpenses();
    for (const pageSize of [0, -5, "abc"]) {
      expect(() => listExpenses(g, { page: 1, pageSize })).toThrow(ValidationError);
    }
  });
});
