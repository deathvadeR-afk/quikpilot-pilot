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

function groupWith(count) {
  const g = createGroup("g", "Test", [
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

  it("[QP-QUIKSPL-258-1] A page is capped at pageSize", () => {
    const result = listExpenses(groupWith(12), { page: 1, pageSize: 10 });
    expect(result.items.length).toBe(10);
  });

  it("[QP-QUIKSPL-258-2] Page 1 and page 2 share no expense", () => {
    const g = groupWith(12);
    const page1 = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.id);
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.id);
    expect(page1.filter((id) => page2.includes(id))).toEqual([]);
  });

  it("[QP-QUIKSPL-258-3] The two pages together account for every expense", () => {
    const g = groupWith(12);
    const page1 = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.id);
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.id);
    const all = [...page1, ...page2];
    expect(all.length).toBe(12);
    expect(new Set(all).size).toBe(12);
  });

  it("[QP-QUIKSPL-258-4] An exact multiple of pageSize neither repeats nor drops an expense", () => {
    const g = groupWith(20);
    const page1 = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.id);
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.id);
    const page3 = listExpenses(g, { page: 3, pageSize: 10 }).items.map((e) => e.id);
    expect(page1.length).toBe(10);
    expect(page2.length).toBe(10);
    expect(page3.length).toBe(0);
    const all = [...page1, ...page2, ...page3];
    expect(all.length).toBe(20);
    expect(new Set(all).size).toBe(20);
  });

  it("[QP-QUIKSPL-258-5] A page size larger than the list returns the whole list once", () => {
    const g = groupWith(12);
    const page1 = listExpenses(g, { page: 1, pageSize: 20 }).items;
    const page2 = listExpenses(g, { page: 2, pageSize: 20 }).items;
    expect(page1.length).toBe(12);
    expect(page2.length).toBe(0);
  });

  it("[QP-QUIKSPL-258-6] A page past the end returns nothing rather than repeating the last page", () => {
    const g = groupWith(12);
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.id);
    const page3 = listExpenses(g, { page: 3, pageSize: 10 }).items.map((e) => e.id);
    expect(page3.length).toBe(0);
    expect(page3.filter((id) => page2.includes(id))).toEqual([]);
  });

  it("[QP-QUIKSPL-258-7] A page size of 1 walks the list without repeats or gaps", () => {
    const g = groupWith(3);
    const page1 = listExpenses(g, { page: 1, pageSize: 1 }).items.map((e) => e.id);
    const page2 = listExpenses(g, { page: 2, pageSize: 1 }).items.map((e) => e.id);
    const page3 = listExpenses(g, { page: 3, pageSize: 1 }).items.map((e) => e.id);
    const page4 = listExpenses(g, { page: 4, pageSize: 1 }).items.map((e) => e.id);
    expect(page1.length).toBe(1);
    expect(page2.length).toBe(1);
    expect(page3.length).toBe(1);
    expect(page4.length).toBe(0);
    const all = [...page1, ...page2, ...page3];
    expect(all.length).toBe(3);
    expect(new Set(all).size).toBe(3);
  });
});
