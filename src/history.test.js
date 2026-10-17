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

  it("[QP-QUIKSPL-239-1] Filters expenses correctly when 'to' date is inclusive of the entire day", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
    ]);
    const add = (description, createdAt) =>
      addExpense(g, { description, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt });

    add("Expense on 2026-10-02 10:00", "2026-10-02T10:00:00.000Z");
    add("Expense on 2026-10-02 14:00", "2026-10-02T14:00:00.000Z");
    add("Expense on 2026-10-03 09:00", "2026-10-03T09:00:00.000Z");

    const result = listExpenses(g, { from: "2026-10-02", to: "2026-10-02" });
    expect(result.items.map((e) => e.description)).toEqual([
      "Expense on 2026-10-02 14:00",
      "Expense on 2026-10-02 10:00",
    ]);
    expect(result.total).toBe(2);
  });

  it("[QP-QUIKSPL-239-2] Excludes expenses created on the day after the 'to' date", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
    ]);
    const add = (description, createdAt) =>
      addExpense(g, { description, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt });

    add("Expense on 2026-10-03 00:00:00.001", "2026-10-03T00:00:00.001Z");

    const result = listExpenses(g, { from: "2026-10-01", to: "2026-10-02" });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("[QP-QUIKSPL-239-3] Maintains existing behavior for full timestamp 'to' filters", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
    ]);
    const add = (description, createdAt) =>
      addExpense(g, { description, amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt });

    add("Expense on 2026-10-02 10:00", "2026-10-02T10:00:00.000Z");
    add("Expense on 2026-10-02 14:00", "2026-10-02T14:00:00.000Z");

    const result = listExpenses(g, { from: "2026-10-02T00:00:00.000Z", to: "2026-10-02T12:00:00.000Z" });
    expect(result.items.map((e) => e.description)).toEqual([
      "Expense on 2026-10-02 10:00",
    ]);
    expect(result.total).toBe(1);
  });
});
