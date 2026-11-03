import { describe, it, expect } from "vitest";
import { addExpense, createGroup, deleteExpense, recordPayment } from "./ledger.js";
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

  it("[QP-QUIKS-7-1] excludes a deleted expense from its category total", () => {
    const g = createGroup("g", "Goa trip", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Meals", amountMinor: 600000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    addExpense(g, { description: "Market", amountMinor: 333050, paidBy: "u2", participants: ["u1", "u2"], category: "food" });
    const deleted = addExpense(g, { description: "Spare", amountMinor: 150000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    deleteExpense(g, deleted.id);
    expect(categoryTotals(g).find((t) => t.category === "food").totalMinor).toBe(933050);
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

  it("[QP-QUIKS-7-2] excludes a deleted expense from the payer's Paid", () => {
    const g = createGroup("g", "Goa trip", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Meals", amountMinor: 400000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    const deleted = addExpense(g, { description: "Spare", amountMinor: 150000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    deleteExpense(g, deleted.id);
    const a = memberSummary(g).find((r) => r.id === "u1");
    expect(a.paidMinor).toBe(400000);
  });

  it("[QP-QUIKS-7-3] excludes a deleted expense from every participant's Share", () => {
    const g = createGroup("g", "Goa trip", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
      { id: "u3", name: "C" },
    ]);
    addExpense(g, { description: "Meals", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    const deleted = addExpense(g, { description: "Spare", amountMinor: 900, paidBy: "u1", participants: ["u1", "u2", "u3"], category: "food" });
    deleteExpense(g, deleted.id);
    const rows = memberSummary(g);
    expect(rows.find((r) => r.id === "u1").owedMinor).toBe(500);
    expect(rows.find((r) => r.id === "u2").owedMinor).toBe(500);
    expect(rows.find((r) => r.id === "u3").owedMinor).toBe(0);
  });
});
