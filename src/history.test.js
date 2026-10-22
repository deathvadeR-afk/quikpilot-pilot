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

  it("[QP-QUIKSPL-320-1] Lists both expenses made on the end date when from and to are the same plain date", () => {
    const g = createGroup("g", "Goa", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Farewell drinks", amountMinor: 100, paidBy: "u1", participants: ["u1", "u2"], createdAt: "2026-10-02T18:00:00.000Z" });
    addExpense(g, { description: "Lunch", amountMinor: 100, paidBy: "u1", participants: ["u1", "u2"], createdAt: "2026-10-02T12:00:00.000Z" });
    const result = listExpenses(g, { from: "2026-10-02", to: "2026-10-02" });
    const ids = result.items.map((e) => e.id);
    expect(result.items.map((e) => e.description).sort()).toEqual(["Farewell drinks", "Lunch"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("[QP-QUIKSPL-320-2] Includes an expense created at the last millisecond of the end date", () => {
    const g = createGroup("g", "Goa", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Late night", amountMinor: 100, paidBy: "u1", participants: ["u1", "u2"], createdAt: "2026-10-02T23:59:59.999Z" });
    const result = listExpenses(g, { to: "2026-10-02" });
    expect(result.items.map((e) => e.description)).toContain("Late night");
  });

  it("[QP-QUIKSPL-320-3] Excludes an expense created at the first millisecond of the day after the end date", () => {
    const g = createGroup("g", "Goa", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Early next day", amountMinor: 100, paidBy: "u1", participants: ["u1", "u2"], createdAt: "2026-10-03T00:00:00.000Z" });
    const result = listExpenses(g, { to: "2026-10-02" });
    expect(result.items.map((e) => e.description)).not.toContain("Early next day");
  });
});
