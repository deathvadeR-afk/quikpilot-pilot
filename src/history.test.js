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
  // Visible expenses are paid by u1 and shared with u2. Hidden ones are paid by u2
  // and shared with u3 only, so the memberId filter for u1 leaves them out.
  function pagedGroup(visibleCount, hiddenCount = 0) {
    const g = createGroup("g", "Paged", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
      { id: "u3", name: "C" },
    ]);
    for (let i = 0; i < visibleCount; i++) {
      addExpense(g, {
        description: `Visible ${i + 1}`,
        amountMinor: 100,
        paidBy: "u1",
        participants: ["u1", "u2"],
        category: "food",
        createdAt: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(),
      });
    }
    for (let i = 0; i < hiddenCount; i++) {
      addExpense(g, {
        description: `Hidden ${i + 1}`,
        amountMinor: 100,
        paidBy: "u2",
        participants: ["u2", "u3"],
        category: "food",
        createdAt: new Date(Date.UTC(2026, 9, 2, 0, i)).toISOString(),
      });
    }
    return g;
  }
  const descriptionsOf = (result) => result.items.map((e) => e.description);

  it("[QP-QUIKSPL-402-1] Page 1 of 12 expenses at page size 10 shows exactly 10 expenses", () => {
    const result = listExpenses(pagedGroup(12), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-402-2] Page 2 does not repeat any expense from page 1 when 12 expenses are paged at size 10", () => {
    const g = pagedGroup(12);
    const firstPage = descriptionsOf(listExpenses(g, { page: 1, pageSize: 10 }));
    const secondPage = descriptionsOf(listExpenses(g, { page: 2, pageSize: 10 }));
    const onFirstPage = new Set(firstPage);
    expect(secondPage.filter((d) => onFirstPage.has(d))).toEqual([]);
  });

  it("[QP-QUIKSPL-402-3] Pages 1 and 2 together show all 12 expenses with no gap", () => {
    const g = pagedGroup(12);
    const firstPage = descriptionsOf(listExpenses(g, { page: 1, pageSize: 10 }));
    const secondPage = descriptionsOf(listExpenses(g, { page: 2, pageSize: 10 }));
    expect(secondPage).toHaveLength(2);
    expect([...firstPage, ...secondPage]).toHaveLength(12);
    expect(new Set([...firstPage, ...secondPage]).size).toBe(12);
  });

  it("[QP-QUIKSPL-402-4] Every page of a 25-expense list holds at most the page size with no overlap", () => {
    const g = pagedGroup(25);
    const pages = [1, 2, 3].map((page) => descriptionsOf(listExpenses(g, { page, pageSize: 10 })));
    expect(pages.map((p) => p.length)).toEqual([10, 10, 5]);
    const all = pages.flat();
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all).size).toBe(25);
  });

  it("[QP-QUIKSPL-402-5] Expenses the user cannot see never appear on any page", () => {
    const g = pagedGroup(12, 3);
    const pages = [1, 2].map((page) => descriptionsOf(listExpenses(g, { memberId: "u1", page, pageSize: 10 })));
    const all = pages.flat();
    expect(all.filter((d) => d.startsWith("Hidden"))).toEqual([]);
    expect(all).toHaveLength(12);
    expect(new Set(all).size).toBe(12);
    expect(all.every((d) => d.startsWith("Visible"))).toBe(true);
  });
});
