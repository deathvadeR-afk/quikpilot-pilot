import { describe, it, expect } from "vitest";
import { addExpense, createGroup, recordPayment } from "./ledger.js";
import { categoryTotals, memberSummary } from "./reports.js";
import { deleteExpense } from "./ledger.js";

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

  it("[QP-QUIKSPL-120-1] Excludes deleted expense from category total", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    addExpense(g, { id: "exp_1", description: "Food", amountMinor: 10000, paidBy: "u1", participants: ["u1"], category: "food" });
    addExpense(g, { id: "exp_2", description: "Food", amountMinor: 40000, paidBy: "u1", participants: ["u1"], category: "food" });
    deleteExpense(g, "exp_1");
    expect(categoryTotals(g)).toEqual([{ category: "food", totalMinor: 40000 }]);
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

  it("[QP-QUIKSPL-120-2] Excludes deleted expense from payer's 'Paid' summary", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "Alice" }]);
    addExpense(g, { id: "exp_1", description: "Expense 1", amountMinor: 15000, paidBy: "u1", participants: ["u1"] });
    addExpense(g, { id: "exp_2", description: "Expense 2", amountMinor: 45000, paidBy: "u1", participants: ["u1"] });
    deleteExpense(g, "exp_1");
    const aliceSummary = memberSummary(g).find((r) => r.id === "u1");
    expect(aliceSummary.paidMinor).toBe(45000);
    expect(aliceSummary.balanceMinor).toBe(0);
  });

  it("[QP-QUIKSPL-120-3] Excludes deleted expense from all members' 'Share' summaries", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "Alice" }, { id: "u2", name: "Bob" }]);
    addExpense(g, { id: "exp_1", description: "Shared Expense 1", amountMinor: 10000, paidBy: "u1", participants: ["u1", "u2"] });
    addExpense(g, { id: "exp_2", description: "Shared Expense 2", amountMinor: 30000, paidBy: "u1", participants: ["u1", "u2"] });
    deleteExpense(g, "exp_1");
    const aliceSummary = memberSummary(g).find((r) => r.id === "u1");
    const bobSummary = memberSummary(g).find((r) => r.id === "u2");
    expect(aliceSummary.owedMinor).toBe(15000);
    expect(bobSummary.owedMinor).toBe(15000);
    expect(aliceSummary.balanceMinor).toBe(15000);
    expect(bobSummary.balanceMinor).toBe(-15000);
  });

  it("[QP-QUIKSPL-120-4] Correctly updates balance after deleting an expense", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "Charlie" }]);
    addExpense(g, { id: "exp_1", description: "Expense 1", amountMinor: 5000, paidBy: "u1", participants: ["u1"] });
    addExpense(g, { id: "exp_2", description: "Expense 2", amountMinor: 30000, paidBy: "u1", participants: ["u1"] });
    deleteExpense(g, "exp_1");
    const charlieSummary = memberSummary(g).find((r) => r.id === "u1");
    expect(charlieSummary.paidMinor).toBe(30000);
    expect(charlieSummary.owedMinor).toBe(30000);
    expect(charlieSummary.balanceMinor).toBe(0);
  });
});
