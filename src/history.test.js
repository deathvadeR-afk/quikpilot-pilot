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

  it("[QP-QUIKSPL-252-1] limits returned expenses to specified page size", () => {
    const g = createGroup("g-many", "Test Many", [{ id: "u1", name: "A" }]);
    for (let i = 1; i <= 12; i++) {
      const day = String(i).padStart(2, "0");
      addExpense(g, {
        description: `Expense ${i}`,
        amountMinor: 100,
        paidBy: "u1",
        participants: ["u1"],
        createdAt: `2026-10-${day}T09:00:00.000Z`,
      });
    }
    const res = listExpenses(g, { page: 1, pageSize: 10 });
    expect(res.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-252-2] prevents duplicate items across adjacent expense pages", () => {
    const g = createGroup("g-many-2", "Test Many 2", [{ id: "u1", name: "A" }]);
    for (let i = 1; i <= 12; i++) {
      const day = String(i).padStart(2, "0");
      addExpense(g, {
        description: `Expense ${i}`,
        amountMinor: 100,
        paidBy: "u1",
        participants: ["u1"],
        createdAt: `2026-10-${day}T09:00:00.000Z`,
      });
    }
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    expect(page2.items).toHaveLength(2);
    const page1Ids = new Set(page1.items.map((e) => e.id));
    const overlap = page2.items.filter((e) => page1Ids.has(e.id));
    expect(overlap).toHaveLength(0);
  });

  it("[QP-QUIKSPL-252-3] handles non-positive page size safely", () => {
    const g = createGroup("g-ten", "Test Ten", [{ id: "u1", name: "A" }]);
    for (let i = 1; i <= 10; i++) {
      const day = String(i).padStart(2, "0");
      addExpense(g, {
        description: `Expense ${i}`,
        amountMinor: 100,
        paidBy: "u1",
        participants: ["u1"],
        createdAt: `2026-10-${day}T09:00:00.000Z`,
      });
    }
    const res = listExpenses(g, { pageSize: 0 });
    expect(res.pageSize).toBeGreaterThan(0);
  });
});
