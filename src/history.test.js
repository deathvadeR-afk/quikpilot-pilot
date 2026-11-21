import { describe, it, expect } from "vitest";
import { addExpense, createGroup, deleteExpense } from "./ledger.js";
import { listExpenses, MAX_PAGE_SIZE } from "./history.js";
import { listRecentlyDeleted, restoreExpense } from "./history.js";

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

describe("recently deleted expenses", () => {
  const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

  it("[QP-QUIKSPL-372-1] Shows an expense deleted three days ago with a Restore button", () => {
    const g = group();
    deleteExpense(g, "exp_1");
    g.expenses[0].deletedAt = daysAgo(3);
    const result = listRecentlyDeleted(g, "u2");
    expect(result.items.map((e) => e.description)).toContain("First");
  });

  it("[QP-QUIKSPL-372-2] Does not list or restore an expense deleted 31 days ago", () => {
    const g = group();
    deleteExpense(g, "exp_1");
    g.expenses[0].deletedAt = daysAgo(31);
    expect(listRecentlyDeleted(g, "u2").items.map((e) => e.description)).not.toContain("First");
    expect(() => restoreExpense(g, "exp_1", "u2")).toThrow();
    expect(g.expenses[0].deletedAt).toBeTruthy();
  });

  it("[QP-QUIKSPL-372-3] Lets another group member see and restore an expense they did not delete", () => {
    const g = group();
    deleteExpense(g, "exp_1");
    g.expenses[0].deletedAt = daysAgo(2);
    expect(listRecentlyDeleted(g, "u2").items.map((e) => e.description)).toContain("First");
    restoreExpense(g, "exp_1", "u2");
    expect(g.expenses[0].deletedAt).toBeFalsy();
  });

  it("[QP-QUIKSPL-372-4] Refuses the recently deleted list and restore for a non-member", () => {
    const g = group();
    deleteExpense(g, "exp_1");
    g.expenses[0].deletedAt = daysAgo(2);
    let listed = [];
    try {
      listed = listRecentlyDeleted(g, "zz").items;
    } catch {
      listed = [];
    }
    expect(listed).toHaveLength(0);
    expect(() => restoreExpense(g, "exp_1", "zz")).toThrow();
    expect(g.expenses[0].deletedAt).toBeTruthy();
  });

  it("[QP-QUIKSPL-372-5] Restored expense sits between its neighbours by original date", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    const add = (description, createdAt) =>
      addExpense(g, { description, amountMinor: 100, paidBy: "u1", participants: ["u1", "u2"], createdAt });
    add("Jan 5", "2026-01-05T09:00:00.000Z");
    add("Jan 20", "2026-01-20T09:00:00.000Z");
    add("Feb 1", "2026-02-01T09:00:00.000Z");
    add("Jan 10", "2026-01-10T09:00:00.000Z");
    deleteExpense(g, "exp_4");
    g.expenses[3].deletedAt = daysAgo(2);
    restoreExpense(g, "exp_4", "u2");
    const names = listExpenses(g).items.map((e) => e.description);
    const i5 = names.indexOf("Jan 5");
    const i10 = names.indexOf("Jan 10");
    const i20 = names.indexOf("Jan 20");
    expect(i10 > Math.min(i5, i20) && i10 < Math.max(i5, i20)).toBe(true);
  });

  it("[QP-QUIKSPL-372-6] Restored expense leaves the recently deleted section", () => {
    const g = group();
    deleteExpense(g, "exp_1");
    g.expenses[0].deletedAt = daysAgo(2);
    restoreExpense(g, "exp_1", "u2");
    expect(listRecentlyDeleted(g, "u2").items.map((e) => e.description)).not.toContain("First");
    expect(listExpenses(g).items.map((e) => e.description)).toContain("First");
  });

  it("[QP-QUIKSPL-372-7] Refuses to restore an expense that is not deleted", () => {
    const g = group();
    expect(() => restoreExpense(g, "exp_1", "u2")).toThrow();
    expect(g.expenses[0].deletedAt).toBeFalsy();
    expect(listExpenses(g).items.map((e) => e.description)).toContain("First");
  });

  it("[QP-QUIKSPL-372-8] Restoring the same expense twice leaves one copy in the history list", () => {
    const g = group();
    deleteExpense(g, "exp_1");
    g.expenses[0].deletedAt = daysAgo(2);
    const attempt = (fn) => {
      try {
        fn();
      } catch {
        // a refused repeat restore is acceptable here
      }
    };
    attempt(() => restoreExpense(g, "exp_1", "u2"));
    attempt(() => restoreExpense(g, "exp_1", "u2"));
    expect(listExpenses(g).items.filter((e) => e.description === "First")).toHaveLength(1);
    expect(listRecentlyDeleted(g, "u2").items.map((e) => e.description)).not.toContain("First");
  });

  it("[QP-QUIKSPL-372-9] Renders a deleted expense description containing script as plain text", () => {
    const g = group();
    deleteExpense(g, "exp_1");
    g.expenses[0].description = "<script>alert(1)</script>";
    g.expenses[0].deletedAt = daysAgo(1);
    const items = listRecentlyDeleted(g, "u2").items;
    expect(items.map((e) => e.description)).toContain("<script>alert(1)</script>");
  });
});
