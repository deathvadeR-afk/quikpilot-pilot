import { describe, it, expect } from "vitest";
import { addExpense, createGroup, recordPayment, deleteExpense } from "./ledger.js";
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

  it("[QP-QUIKSPL-149-1] Deleted expense is excluded from category total", () => {
    const g = group();
    const expenseToDelete = g.expenses[0]; // Lunch, 1000, food
    expect(categoryTotals(g)).toEqual([
      { category: "food", totalMinor: 4000 },
      { category: "travel", totalMinor: 500 },
    ]);
    deleteExpense(g, expenseToDelete.id);
    expect(categoryTotals(g)).toEqual([
      { category: "food", totalMinor: 3000 },
      { category: "travel", totalMinor: 500 },
    ]);
  });

  it("[QP-QUIKSPL-149-2] Deleted expense is excluded from payer's 'Paid' summary", () => {
    const g = group();
    const expenseToDelete = g.expenses[0]; // Lunch, 1000, paidBy: u1
    const initialSummary = memberSummary(g);
    const u1InitialPaid = initialSummary.find((r) => r.id === "u1").paidMinor;
    deleteExpense(g, expenseToDelete.id);
    const finalSummary = memberSummary(g);
    const u1FinalPaid = finalSummary.find((r) => r.id === "u1").paidMinor;
    expect(u1FinalPaid).toBe(u1InitialPaid - expenseToDelete.amountMinor);
  });

  it("[QP-QUIKSPL-149-3] Deleted expense is excluded from sharer's 'Share' summary", () => {
    const g = group();
    const expenseToDelete = g.expenses[0]; // Lunch, 1000, participants: ["u1", "u2"], share 500 each
    const initialSummary = memberSummary(g);
    const u1InitialOwed = initialSummary.find((r) => r.id === "u1").owedMinor;
    deleteExpense(g, expenseToDelete.id);
    const finalSummary = memberSummary(g);
    const u1FinalOwed = finalSummary.find((r) => r.id === "u1").owedMinor;
    expect(u1FinalOwed).toBe(u1InitialOwed - 500);
  });

  it("[QP-QUIKSPL-149-4] Multiple deleted expenses are correctly excluded from all totals", () => {
    const g = group();
    const expense1 = g.expenses[0]; // Lunch, 1000, food, u1 paid, u1/u2 shared
    const expense2 = g.expenses[1]; // Dinner, 3000, food, u2 paid, u1/u2 shared
    const expense3 = g.expenses[2]; // Bus, 500, travel, u1 paid, u1/u2 shared

    const initialCategoryTotals = categoryTotals(g);
    const initialMemberSummary = memberSummary(g);

    deleteExpense(g, expense1.id);
    deleteExpense(g, expense2.id);
    deleteExpense(g, expense3.id);

    const finalCategoryTotals = categoryTotals(g);
    const finalMemberSummary = memberSummary(g);

    expect(finalCategoryTotals).toEqual([]);
    expect(finalMemberSummary.find(r => r.id === 'u1').paidMinor).toBe(0);
    expect(finalMemberSummary.find(r => r.id === 'u1').owedMinor).toBe(0);
    expect(finalMemberSummary.find(r => r.id === 'u2').paidMinor).toBe(0);
    expect(finalMemberSummary.find(r => r.id === 'u2').owedMinor).toBe(0);
  });

  it("[QP-QUIKSPL-149-5] Deleting an already deleted expense has no further effect on totals", () => {
    const g = group();
    const expenseToDelete = g.expenses[0]; // Lunch, 1000, food
    deleteExpense(g, expenseToDelete.id);

    const totalsAfterFirstDelete = categoryTotals(g);
    const summaryAfterFirstDelete = memberSummary(g);

    // Attempt to delete again
    try {
      deleteExpense(g, expenseToDelete.id);
    } catch (error) {
      expect(error.message).toBe("This expense is already deleted.");
    }

    const totalsAfterSecondDelete = categoryTotals(g);
    const summaryAfterSecondDelete = memberSummary(g);

    expect(totalsAfterSecondDelete).toEqual(totalsAfterFirstDelete);
    expect(summaryAfterSecondDelete).toEqual(summaryAfterFirstDelete);
  });
});
