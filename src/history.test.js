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

  it("[QP-QUIKSPL-345-2] shows only expenses whose description contains the search term", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    addExpense(g, { description: "Groceries at Corner Store", amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: "2026-10-01T09:00:00.000Z" });
    addExpense(g, { description: "Taxi to airport", amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "travel", createdAt: "2026-10-02T09:00:00.000Z" });
    addExpense(g, { description: "Corner Store snacks", amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "food", createdAt: "2026-10-03T09:00:00.000Z" });
    const descriptions = listExpenses(g, { search: "Corner Store" }).items.map((e) => e.description);
    expect(descriptions.sort()).toEqual(["Corner Store snacks", "Groceries at Corner Store"]);
  });

  it("[QP-QUIKSPL-345-3] does not show an expense that matches the term only by category", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "Ravi" }]);
    addExpense(g, { description: "Taxi to airport", amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "Transport", createdAt: "2026-10-01T09:00:00.000Z" });
    const descriptions = listExpenses(g, { search: "Transport" }).items.map((e) => e.description);
    expect(descriptions).not.toContain("Taxi to airport");
  });

  it("[QP-QUIKSPL-345-4] does not show an expense that matches the term only by member name", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "Ravi" }]);
    addExpense(g, { description: "Taxi to airport", amountMinor: 100, paidBy: "u1", participants: ["u1"], category: "Transport", createdAt: "2026-10-01T09:00:00.000Z" });
    const descriptions = listExpenses(g, { search: "Ravi" }).items.map((e) => e.description);
    expect(descriptions).not.toContain("Taxi to airport");
  });
});
