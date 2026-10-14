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

  it("[QP-QUIKSPL-200-1] Category totals exclude deleted expenses", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" }
    ]);
    addExpense(g, { description: "Food Item 1", amountMinor: 5000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    addExpense(g, { description: "Food Item 2", amountMinor: 4330.50, paidBy: "u2", participants: ["u1", "u2"], category: "food" });
    const deletedExp = addExpense(g, { description: "Deleted Food", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"], category: "food", isDeleted: true });
    deletedExp.deletedAt = new Date().toISOString();
    expect(categoryTotals(g)).toEqual([
      { category: "food", totalMinor: 9330.50 },
    ]);
  });

  it("[QP-QUIKSPL-200-5] Category totals are correct when no expenses are deleted", () => {
    const g = group();
    expect(categoryTotals(g)).toEqual([
      { category: "food", totalMinor: 4000 },
      { category: "travel", totalMinor: 500 },
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

  it("[QP-QUIKSPL-200-2] Member 'Paid' amount excludes deleted expenses", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" }
    ]);
    addExpense(g, { description: "Non-deleted expense", amountMinor: 500, paidBy: "u1", participants: ["u1", "u2"] });
    const deletedExp = addExpense(g, { description: "Deleted expense", amountMinor: 100, paidBy: "u1", participants: ["u1", "u2"], isDeleted: true });
    deletedExp.deletedAt = new Date().toISOString();
    addExpense(g, { description: "Member B expense", amountMinor: 200, paidBy: "u2", participants: ["u1", "u2"] });

    const rows = memberSummary(g);
    const a = rows.find((r) => r.id === "u1");
    const b = rows.find((r) => r.id === "u2");

    expect(a.paidMinor).toBe(500);
    expect(b.paidMinor).toBe(200);
  });

  it("[QP-QUIKSPL-200-3] Member 'Share' amount excludes deleted expenses", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" }
    ]);
    addExpense(g, { description: "Non-deleted expense", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"] });
    const deletedExp = addExpense(g, { description: "Deleted expense", amountMinor: 100, paidBy: "u1", participants: ["u1", "u2"], isDeleted: true });
    deletedExp.deletedAt = new Date().toISOString();

    const rows = memberSummary(g);
    const a = rows.find((r) => r.id === "u1");
    const b = rows.find((r) => r.id === "u2");

    expect(a.owedMinor).toBe(500);
    expect(b.owedMinor).toBe(500);
  });

  it("[QP-QUIKSPL-200-4] Member 'Paid minus Share' balance is correct after excluding deleted expenses", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" }
    ]);
    addExpense(g, { description: "Non-deleted expense", amountMinor: 800, paidBy: "u1", participants: ["u1", "u2"] }); // A paid 800, share 400
    const deletedExp = addExpense(g, { description: "Deleted expense", amountMinor: 100, paidBy: "u1", participants: ["u1", "u2"], isDeleted: true });
    deletedExp.deletedAt = new Date().toISOString();

    const rows = memberSummary(g);
    const a = rows.find((r) => r.id === "u1");

    expect(a.paidMinor).toBe(800);
    expect(a.owedMinor).toBe(400);
    expect(a.balanceMinor).toBe(400);
  });

  it("[QP-QUIKSPL-200-6] Member summary is correct when no expenses are deleted", () => {
    const g = group();
    const rows = memberSummary(g);
    const a = rows.find((r) => r.id === "u1");
    const b = rows.find((r) => r.id === "u2");
    expect(a).toMatchObject({ paidMinor: 1500, owedMinor: 2250, balanceMinor: -750 });
    expect(b).toMatchObject({ paidMinor: 3000, owedMinor: 2250, balanceMinor: 750 });
  });
});
