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

  it("[QP-QUIKSPL-110-1] Category total excludes a deleted expense", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    addExpense(g, { id: "exp_1", description: "Food Item 1", amountMinor: 800, paidBy: "u1", participants: ["u1"], category: "food" });
    addExpense(g, { id: "exp_2", description: "Food Item 2", amountMinor: 200, paidBy: "u1", participants: ["u1"], category: "food" });
    deleteExpense(g, "exp_2");
    expect(categoryTotals(g)).toEqual([{ category: "food", totalMinor: 800 }]);
  });

  it("[QP-QUIKSPL-110-5] Goa trip food total matches example after deletion", () => {
    const g = createGroup("Goa Trip", "Goa", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { id: "exp_1", description: "Dinner", amountMinor: 486050, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    addExpense(g, { id: "exp_2", description: "Lunch", amountMinor: 933000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    deleteExpense(g, "exp_1");
    expect(categoryTotals(g)).toEqual([{ category: "food", totalMinor: 933000 }]);
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

  it("[QP-QUIKSPL-110-2] Member 'Paid' summary excludes a deleted expense", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    addExpense(g, { id: "exp_1", description: "Paid Item 1", amountMinor: 350, paidBy: "u1", participants: ["u1"] });
    addExpense(g, { id: "exp_2", description: "Paid Item 2", amountMinor: 150, paidBy: "u1", participants: ["u1"] });
    deleteExpense(g, "exp_2");
    const member = memberSummary(g).find((r) => r.id === "u1");
    expect(member.paidMinor).toBe(350);
  });

  it("[QP-QUIKSPL-110-3] Member 'Share' summary excludes a deleted expense", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { id: "exp_1", description: "Shared Item 1", amountMinor: 400, paidBy: "u1", participants: ["u1", "u2"] });
    addExpense(g, { id: "exp_2", description: "Shared Item 2", amountMinor: 200, paidBy: "u1", participants: ["u1", "u2"] });
    deleteExpense(g, "exp_2");
    const member = memberSummary(g).find((r) => r.id === "u1");
    expect(member.owedMinor).toBe(200);
  });

  it("[QP-QUIKSPL-110-4] Member balance is correct after expense deletion", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { id: "exp_1", description: "Expense 1", amountMinor: 400, paidBy: "u1", participants: ["u1", "u2"] });
    addExpense(g, { id: "exp_2", description: "Expense 2", amountMinor: 100, paidBy: "u1", participants: ["u1", "u2"] });
    deleteExpense(g, "exp_2");
    const member = memberSummary(g).find((r) => r.id === "u1");
    expect(member.paidMinor).toBe(400);
    expect(member.owedMinor).toBe(200);
    expect(member.balanceMinor).toBe(200);
  });
});
