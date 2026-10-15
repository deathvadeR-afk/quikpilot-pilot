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

  it("[QP-QUIKSPL-242-1] excludes deleted expenses from category totals calculation", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Active Food", amountMinor: 933050, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    const deletedExp = addExpense(g, { description: "Deleted Food", amountMinor: 50000, paidBy: "u2", participants: ["u1", "u2"], category: "food" });
    deletedExp.deletedAt = new Date().toISOString();
    const totals = categoryTotals(g);
    const foodCategory = totals.find((c) => c.category === "food");
    expect(foodCategory.totalMinor).toBe(933050);
  });

  it("[QP-QUIKSPL-242-2] excludes deleted expenses from member paid and share amounts", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Active", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"] });
    const deletedExp = addExpense(g, { description: "Deleted", amountMinor: 2000, paidBy: "u2", participants: ["u1", "u2"] });
    deletedExp.deletedAt = new Date().toISOString();
    const rows = memberSummary(g);
    const u1 = rows.find((r) => r.id === "u1");
    const u2 = rows.find((r) => r.id === "u2");
    expect(u1.paidMinor).toBe(1000);
    expect(u1.owedMinor).toBe(500);
    expect(u1.paidMinor - u1.owedMinor).toBe(u1.balanceMinor);
    expect(u2.paidMinor).toBe(0);
    expect(u2.owedMinor).toBe(500);
    expect(u2.paidMinor - u2.owedMinor).toBe(u2.balanceMinor);
  });
});
