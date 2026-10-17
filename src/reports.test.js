import { describe, it, expect } from "vitest";
import { addExpense, createGroup, recordPayment } from "./ledger.js";
import { categoryTotals, memberSummary } from "./reports.js";
import { deleteExpense } from "./ledger.js";
import { getGroup } from "./store.js";

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

describe("deleted expenses in reports", () => {
  function groupWithDeletedExpense() {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    const deleted = addExpense(g, { description: "Snacks", amountMinor: 50000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    addExpense(g, { description: "Dinner", amountMinor: 100000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    deleteExpense(g, deleted.id);
    return g;
  }

  it("[QP-QUIKSPL-267-1] Excludes a deleted expense from its category total", () => {
    const food = categoryTotals(groupWithDeletedExpense()).find((c) => c.category === "food");
    expect(food).toMatchObject({ totalMinor: 100000 });
  });

  it("[QP-QUIKSPL-267-2] Excludes a deleted expense from a member's Paid and Share", () => {
    const a = memberSummary(groupWithDeletedExpense()).find((r) => r.id === "u1");
    expect(a).toMatchObject({ paidMinor: 100000, owedMinor: 50000 });
  });

  it("[QP-QUIKSPL-267-3] Paid minus Share matches Balance after a deletion", () => {
    const rows = memberSummary(groupWithDeletedExpense());
    for (const row of rows) {
      expect(row.paidMinor - row.owedMinor).toBe(row.balanceMinor);
    }
  });

  it("[QP-QUIKSPL-267-4] Goa trip food total matches the expected figure", () => {
    const food = categoryTotals(getGroup("g1")).find((c) => c.category === "food");
    // 9,330.50 expressed in minor units
    expect(food).toMatchObject({ totalMinor: 933050 });
  });

  it("[QP-QUIKSPL-267-5] Active expenses still count after the change", () => {
    const g = group();
    const food = categoryTotals(g).find((c) => c.category === "food");
    const travel = categoryTotals(g).find((c) => c.category === "travel");
    expect(food).toMatchObject({ totalMinor: 4000 });
    expect(travel).toMatchObject({ totalMinor: 500 });
    const rows = memberSummary(g);
    expect(rows.find((r) => r.id === "u1")).toMatchObject({ paidMinor: 1500, owedMinor: 2250 });
    expect(rows.find((r) => r.id === "u2")).toMatchObject({ paidMinor: 3000, owedMinor: 2250 });
  });
});
