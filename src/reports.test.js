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

  it("[QP-QUIKSPL-122-1] Category totals exclude a deleted expense", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    const exp1 = addExpense(g, { description: "Food", amountMinor: 10000, paidBy: "u1", participants: ["u1"], category: "food" });
    addExpense(g, { description: "Travel", amountMinor: 5000, paidBy: "u1", participants: ["u1"], category: "travel" });
    expect(categoryTotals(g)).toEqual([{ category: "food", totalMinor: 10000 }, { category: "travel", totalMinor: 5000 }]);
    deleteExpense(g, exp1.id);
    expect(categoryTotals(g)).toEqual([{ category: "travel", totalMinor: 5000 }]);
  });

  it("[QP-QUIKSPL-122-2] Member 'Paid' excludes a deleted expense", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    const exp1 = addExpense(g, { description: "Paid by A", amountMinor: 5000, paidBy: "u1", participants: ["u1"] });
    expect(memberSummary(g).find((r) => r.id === "u1").paidMinor).toBe(5000);
    deleteExpense(g, exp1.id);
    expect(memberSummary(g).find((r) => r.id === "u1").paidMinor).toBe(0);
  });

  it("[QP-QUIKSPL-122-3] Member 'Share' excludes a deleted expense", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    const exp1 = addExpense(g, { description: "Share for A", amountMinor: 2500, paidBy: "u1", participants: ["u1"] });
    expect(memberSummary(g).find((r) => r.id === "u1").owedMinor).toBe(2500);
    deleteExpense(g, exp1.id);
    expect(memberSummary(g).find((r) => r.id === "u1").owedMinor).toBe(0);
  });

  it("[QP-QUIKSPL-122-4] Member 'Paid minus Share' matches 'Balance' after deletion", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    const exp1 = addExpense(g, { description: "Expense for A", amountMinor: 10000, paidBy: "u1", participants: ["u1"] });
    let summaryA = memberSummary(g).find((r) => r.id === "u1");
    expect(summaryA.paidMinor).toBe(10000);
    expect(summaryA.owedMinor).toBe(10000);
    expect(summaryA.balanceMinor).toBe(0);
    deleteExpense(g, exp1.id);
    summaryA = memberSummary(g).find((r) => r.id === "u1");
    expect(summaryA.paidMinor).toBe(0);
    expect(summaryA.owedMinor).toBe(0);
    expect(summaryA.balanceMinor).toBe(0);
    expect(summaryA.paidMinor - summaryA.owedMinor).toBe(summaryA.balanceMinor);
  });

  it("[QP-QUIKSPL-122-5] Multiple deleted expenses correctly update all affected totals and member summaries", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" }
    ]);
    const exp1 = addExpense(g, { description: "Food 1", amountMinor: 1000, paidBy: "u1", participants: ["u1"], category: "food" });
    const exp2 = addExpense(g, { description: "Travel 1", amountMinor: 2000, paidBy: "u2", participants: ["u2"], category: "travel" });
    const exp3 = addExpense(g, { description: "Food 2", amountMinor: 500, paidBy: "u1", participants: ["u1", "u2"], category: "food" });

    let totals = categoryTotals(g);
    expect(totals).toEqual([
      { category: "travel", totalMinor: 2000 },
      { category: "food", totalMinor: 1500 }
    ]);
    let summaryA = memberSummary(g).find((r) => r.id === "u1");
    let summaryB = memberSummary(g).find((r) => r.id === "u2");
    expect(summaryA).toMatchObject({ paidMinor: 1500, owedMinor: 1250 });
    expect(summaryB).toMatchObject({ paidMinor: 2000, owedMinor: 2250 });

    deleteExpense(g, exp1.id);
    deleteExpense(g, exp2.id);

    totals = categoryTotals(g);
    expect(totals).toEqual([
      { category: "food", totalMinor: 500 }
    ]);
    summaryA = memberSummary(g).find((r) => r.id === "u1");
    summaryB = memberSummary(g).find((r) => r.id === "u2");
    expect(summaryA).toMatchObject({ paidMinor: 500, owedMinor: 250 });
    expect(summaryB).toMatchObject({ paidMinor: 0, owedMinor: 250 });
  });
});
