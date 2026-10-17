import { describe, it, expect } from "vitest";
import { addExpense, createGroup, recordPayment } from "./ledger.js";
import { categoryTotals, memberSummary } from "./reports.js";

function group() {
  const g = createGroup("g", "Test", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
  ]);
  addExpense(g, { description: "Lunch", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
  addExpense(g, { description: "Dinner", amountMinor: 3000, paidBy: "u2", participants: ["u1", "u2"], category: "food" });
  addExpense(g, { description: "Bus", amountMinor: 500, paidBy: "u1", participants: ["u1", "u2"], category: "travel" });
  return g;
}

describe("categoryTotals", () => {
  it("adds up spend per category, largest first", () => {
    expect(categoryTotals(group())).toEqual([
      { category: "food", totalMinor: 4000 },
      { category: "travel", totalMinor: 500 },
    ]);
  });

  it("files an expense with no category under other", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    addExpense(g, { description: "Old", amountMinor: 700, paidBy: "u1", participants: ["u1"] });
    expect(categoryTotals(g)).toEqual([{ category: "other", totalMinor: 700 }]);
  });

  it("[QP-QUIKSPL-117-1] Deleted expense is excluded from category totals", () => {
    const g = createGroup("g", "Goa Trip", [
      { id: "u1", name: "Alice" },
      { id: "u2", name: "Bob" }
    ]);
    addExpense(g, { description: "Dinner", amountMinor: 10000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    addExpense(g, { description: "Snacks", amountMinor: 670, paidBy: "u1", participants: ["u1", "u2"], category: "food", deletedAt: new Date().toISOString() });
    expect(categoryTotals(g)).toEqual([
      { category: "food", totalMinor: 10000 }
    ]);
  });
});

describe("memberSummary", () => {
  it("reports what each member paid and what their share came to", () => {
    const rows = memberSummary(group());
    const a = rows.find((r) => r.id === "u1");
    const b = rows.find((r) => r.id === "u2");
    expect(a).toMatchObject({ paidMinor: 1500, owedMinor: 2250 });
    expect(b).toMatchObject({ paidMinor: 3000, owedMinor: 2250 });
  });

  it("includes the balance after payments between members", () => {
    const g = group();
    recordPayment(g, { from: "u1", to: "u2", amountMinor: 500 });
    const a = memberSummary(g).find((r) => r.id === "u1");
    expect(a.balanceMinor).toBe(-750 + 500);
  });

  it("[QP-QUIKSPL-117-2] Deleted expense is excluded from member 'Paid' summary", () => {
    const g = group();
    addExpense(g, { description: "Deleted Paid", amountMinor: 500, paidBy: "u1", participants: ["u1", "u2"], deletedAt: new Date().toISOString() });
    const rows = memberSummary(g);
    const a = rows.find((r) => r.id === "u1");
    expect(a.paidMinor).toBe(1500);
    expect(a.paidMinor - a.owedMinor).toBe(a.balanceMinor);
  });

  it("[QP-QUIKSPL-117-3] Deleted expense is excluded from member 'Share' summary", () => {
    const g = group();
    addExpense(g, { description: "Deleted Share", amountMinor: 500, paidBy: "u1", participants: ["u1", "u2"], splitType: "exact", splitDetails: { u1: 250, u2: 250 }, deletedAt: new Date().toISOString() });
    const rows = memberSummary(g);
    const b = rows.find((r) => r.id === "u2");
    expect(b.owedMinor).toBe(2250);
    expect(b.paidMinor - b.owedMinor).toBe(b.balanceMinor);
  });

  it("[QP-QUIKSPL-117-4] Multiple deleted expenses are excluded from all totals", () => {
    const g = group();
    addExpense(g, { description: "Deleted Food", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"], category: "food", deletedAt: new Date().toISOString() });
    addExpense(g, { description: "Deleted Travel", amountMinor: 500, paidBy: "u2", participants: ["u1", "u2"], category: "travel", deletedAt: new Date().toISOString() });
    const categoryReports = categoryTotals(g);
    expect(categoryReports).toEqual([
      { category: "food", totalMinor: 4000 },
      { category: "travel", totalMinor: 500 }
    ]);
    const memberReports = memberSummary(g);
    const a = memberReports.find((r) => r.id === "u1");
    const b = memberReports.find((r) => r.id === "u2");
    expect(a.paidMinor).toBe(1500);
    expect(a.owedMinor).toBe(2250);
    expect(a.paidMinor - a.owedMinor).toBe(a.balanceMinor);
    expect(b.paidMinor).toBe(3000);
    expect(b.owedMinor).toBe(2250);
    expect(b.paidMinor - b.owedMinor).toBe(b.balanceMinor);
  });
});
