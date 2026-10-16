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
});

describe("deleted expenses", () => {
  it("[QP-QUIKSPL-260-1] Goa trip food total excludes the deleted expense", () => {
    const g = createGroup("goa", "Goa", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Beach shack", amountMinor: 500000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    addExpense(g, { description: "Seafood", amountMinor: 433050, paidBy: "u2", participants: ["u1", "u2"], category: "food" });
    const removed = addExpense(g, { description: "Cancelled booking", amountMinor: 100000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    deleteExpense(g, removed.id);

    const food = categoryTotals(g).find((c) => c.category === "food");
    expect(food.totalMinor).toBe(933050);
  });

  it("[QP-QUIKSPL-260-2] A category whose only expense was deleted contributes nothing", () => {
    const g = createGroup("t", "Trip", [{ id: "u1", name: "A" }]);
    const taxi = addExpense(g, { description: "Taxi", amountMinor: 1200, paidBy: "u1", participants: ["u1"], category: "transport" });
    addExpense(g, { description: "Snack", amountMinor: 500, paidBy: "u1", participants: ["u1"], category: "food" });
    deleteExpense(g, taxi.id);

    const totals = categoryTotals(g);
    expect(totals.reduce((sum, c) => sum + c.totalMinor, 0)).toBe(500);
    expect(totals.some((c) => c.totalMinor === 1200)).toBe(false);
  });

  it("[QP-QUIKSPL-260-3] Member Paid and Share exclude the deleted expense", () => {
    const g = createGroup("t", "Trip", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    const removed = addExpense(g, { description: "Cancelled", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    addExpense(g, { description: "A paid", amountMinor: 2000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    addExpense(g, { description: "B paid", amountMinor: 2000, paidBy: "u2", participants: ["u1", "u2"], category: "food" });
    deleteExpense(g, removed.id);

    const rows = memberSummary(g);
    const a = rows.find((r) => r.id === "u1");
    const b = rows.find((r) => r.id === "u2");
    expect(a.paidMinor).toBe(2000);
    expect(b.paidMinor).toBe(2000);
    expect(a.owedMinor).toBe(2000);
    expect(b.owedMinor).toBe(2000);
  });

  it("[QP-QUIKSPL-260-4] Paid minus Share matches Balance after a deletion", () => {
    const g = createGroup("t", "Trip", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
      { id: "u3", name: "C" },
    ]);
    const removed = addExpense(g, { description: "Cancelled", amountMinor: 900, paidBy: "u1", participants: ["u1", "u2", "u3"], category: "food" });
    addExpense(g, { description: "Dinner", amountMinor: 3000, paidBy: "u1", participants: ["u1", "u2", "u3"], category: "food" });
    addExpense(g, { description: "Taxi", amountMinor: 1500, paidBy: "u2", participants: ["u1", "u2", "u3"], category: "transport" });
    deleteExpense(g, removed.id);

    for (const row of memberSummary(g)) {
      expect(row.paidMinor - row.owedMinor).toBe(row.balanceMinor);
    }
  });

  it("[QP-QUIKSPL-260-5] Every member of the trip sees the same corrected figures", () => {
    const g = createGroup("t", "Trip", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    const removed = addExpense(g, { description: "Cancelled", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    addExpense(g, { description: "A paid", amountMinor: 2000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    addExpense(g, { description: "B paid", amountMinor: 2000, paidBy: "u2", participants: ["u1", "u2"], category: "food" });
    deleteExpense(g, removed.id);

    expect(categoryTotals(g)).toEqual([{ category: "food", totalMinor: 4000 }]);

    const rows = memberSummary(g);
    const a = rows.find((r) => r.id === "u1");
    const b = rows.find((r) => r.id === "u2");
    expect(a).toMatchObject({ paidMinor: 2000, owedMinor: 2000, balanceMinor: 0 });
    expect(b).toMatchObject({ paidMinor: 2000, owedMinor: 2000, balanceMinor: 0 });
  });

  it("[QP-QUIKSPL-260-6] Deleting in one trip does not change another trip", () => {
    const first = createGroup("first", "First", [{ id: "u1", name: "A" }]);
    const removed = addExpense(first, { description: "Cancelled", amountMinor: 1000, paidBy: "u1", participants: ["u1"], category: "food" });
    addExpense(first, { description: "Lunch", amountMinor: 2000, paidBy: "u1", participants: ["u1"], category: "food" });

    const second = createGroup("second", "Second", [{ id: "u2", name: "B" }]);
    addExpense(second, { description: "Dinner", amountMinor: 3000, paidBy: "u2", participants: ["u2"], category: "food" });
    addExpense(second, { description: "Bus", amountMinor: 500, paidBy: "u2", participants: ["u2"], category: "transport" });

    const totalsBefore = categoryTotals(second);
    const summaryBefore = memberSummary(second);

    deleteExpense(first, removed.id);

    expect(categoryTotals(second)).toEqual(totalsBefore);
    expect(memberSummary(second)).toEqual(summaryBefore);
  });
});
