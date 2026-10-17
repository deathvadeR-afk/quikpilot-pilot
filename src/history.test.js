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

  it("[QP-QUIKSPL-271-1] Lists both expenses from the reported day when from and to are the same plain date", () => {
    const g = createGroup("goa", "Goa trip", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Farewell drinks", amountMinor: 500, paidBy: "u1", participants: ["u1", "u2"], createdAt: "2026-10-02T10:00:00.000Z" });
    addExpense(g, { description: "Lunch", amountMinor: 800, paidBy: "u2", participants: ["u1", "u2"], createdAt: "2026-10-02T13:00:00.000Z" });
    const result = listExpenses(g, { from: "2026-10-02", to: "2026-10-02" });
    expect(result.items.map((e) => e.description).sort()).toEqual(["Farewell drinks", "Lunch"]);
  });

  it("[QP-QUIKSPL-271-2] Includes an expense created late in the day when the end date is a plain date", () => {
    const g = createGroup("goa", "Goa trip", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Late dinner", amountMinor: 900, paidBy: "u1", participants: ["u1", "u2"], createdAt: "2026-10-02T23:30:00.000Z" });
    const result = listExpenses(g, { to: "2026-10-02" });
    expect(result.items.map((e) => e.description)).toContain("Late dinner");
  });

  it("[QP-QUIKSPL-271-3] Excludes expenses created on the day after a plain end date", () => {
    const g = createGroup("goa", "Goa trip", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Early start", amountMinor: 300, paidBy: "u1", participants: ["u1", "u2"], createdAt: "2026-10-03T00:10:00.000Z" });
    const result = listExpenses(g, { to: "2026-10-02" });
    expect(result.items.map((e) => e.description)).not.toContain("Early start");
  });

  it("[QP-QUIKSPL-271-4] Applies a full timestamp end of range exactly as before", () => {
    const g = createGroup("goa", "Goa trip", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Afternoon walk", amountMinor: 400, paidBy: "u1", participants: ["u1", "u2"], createdAt: "2026-10-02T14:00:00.000Z" });
    addExpense(g, { description: "Evening walk", amountMinor: 400, paidBy: "u1", participants: ["u1", "u2"], createdAt: "2026-10-02T18:00:00.000Z" });
    const result = listExpenses(g, { to: "2026-10-02T15:00:00Z" });
    expect(result.items.map((e) => e.description)).toEqual(["Afternoon walk"]);
  });

  it("[QP-QUIKSPL-271-5] Uses the same UTC day boundary for a plain end date regardless of user", () => {
    const g = createGroup("goa", "Goa trip", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Late dinner", amountMinor: 900, paidBy: "u1", participants: ["u1", "u2"], createdAt: "2026-10-02T23:30:00.000Z" });
    const forFirstUser = listExpenses(g, { to: "2026-10-02" });
    const forSecondUser = listExpenses(g, { to: "2026-10-02" });
    expect(forSecondUser.items.map((e) => e.description)).toEqual(forFirstUser.items.map((e) => e.description));
    expect(forFirstUser.items.map((e) => e.description)).toContain("Late dinner");
  });
});
