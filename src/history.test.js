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

  describe("paging a larger group", () => {
    function groupOf(count) {
      const g = createGroup("g", "Big", [
        { id: "u1", name: "A" },
        { id: "u2", name: "B" },
      ]);
      const base = Date.UTC(2026, 9, 1);
      for (let i = 1; i <= count; i++) {
        addExpense(g, {
          description: `E${i}`,
          amountMinor: 100,
          paidBy: "u1",
          participants: ["u1", "u2"],
          category: "food",
          createdAt: new Date(base + (1000 - i) * 60000).toISOString(),
        });
      }
      return g;
    }

    it("[QP-QUIKSPL-417-1] returns at most pageSize expenses on each full page", () => {
      const g = groupOf(25);
      expect(listExpenses(g, { page: 1, pageSize: 10 }).items).toHaveLength(10);
      expect(listExpenses(g, { page: 2, pageSize: 10 }).items).toHaveLength(10);
      expect(listExpenses(g, { page: 3, pageSize: 10 }).items).toHaveLength(5);
    });

    it("[QP-QUIKSPL-417-2] page 1 returns the first 10 of 12 expenses and page 2 returns the other 2", () => {
      const g = groupOf(12);
      const page1 = listExpenses(g, { page: 1, pageSize: 10 });
      const page2 = listExpenses(g, { page: 2, pageSize: 10 });
      expect(page1.items.map((e) => e.description)).toEqual(["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9", "E10"]);
      expect(page2.items.map((e) => e.description)).toEqual(["E11", "E12"]);
    });

    it("[QP-QUIKSPL-417-3] does not repeat the 11th expense on page 2 (reported defect)", () => {
      const g = groupOf(12);
      const page1 = listExpenses(g, { page: 1, pageSize: 10 });
      const page2 = listExpenses(g, { page: 2, pageSize: 10 });
      expect(page2.items.map((e) => e.description)).toEqual(["E11", "E12"]);
      expect(page1.items.map((e) => e.description)).not.toContain("E11");
      expect(page1.items.map((e) => e.description)).not.toContain("E12");
    });

    it("[QP-QUIKSPL-417-4] listing all pages returns every expense exactly once", () => {
      const g = groupOf(25);
      const all = [1, 2, 3].flatMap((page) => listExpenses(g, { page, pageSize: 10 }).items.map((e) => e.id));
      expect(all).toHaveLength(25);
      expect(new Set(all).size).toBe(25);
    });
  });
});
