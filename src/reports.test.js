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

  it("[QP-QUIKSPL-136-1] Category totals exclude a deleted expense", () => {
    const g = group();
    addExpense(g, { description: "Deleted Food", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    deleteExpense(g, "exp_4"); // exp_1, exp_2, exp_3 are from group(), exp_4 is the new one
    expect(categoryTotals(g)).toEqual([
      { category: "food", totalMinor: 4000 }, // Original food total (1000+3000) remains, deleted is excluded
      { category: "travel", totalMinor: 500 },
    ]);
  });

  it("[QP-QUIKSPL-136-4] Goa trip food total matches expected value after deletion", () => {
    const g = createGroup("g1", "Goa trip", [
      { id: "u1", name: "Aditi" },
      { id: "u2", name: "Bhavin" },
      { id: "u3", name: "Chirag" },
      { id: "u5", name: "Esha" },
    ]);
    addExpense(g, { id: "exp_1", description: "Beach house", amountMinor: 1200000, paidBy: "u1", participants: ["u1", "u2", "u3"], category: "stay" });
    addExpense(g, { id: "exp_2", description: "Seafood dinner", amountMinor: 486000, paidBy: "u2", participants: ["u1", "u2", "u3", "u5"], category: "food" });
    addExpense(g, { id: "exp_3", description: "Scooter rental", amountMinor: 320000, paidBy: "u3", participants: ["u1", "u2", "u3", "u5"], category: "travel", splitType: "shares", splitDetails: { u1: 1, u2: 1, u3: 2, u5: 1 } });
    addExpense(g, { id: "exp_4", description: "Duplicate dinner entry", amountMinor: 486000, paidBy: "u2", participants: ["u1", "u2", "u3", "u5"], category: "food" });
    deleteExpense(g, "exp_4");
    addExpense(g, { id: "exp_5", description: "Water sports", amountMinor: 12000, currency: "USD", paidBy: "u1", participants: ["u1", "u2", "u5"], category: "entertainment" });
    addExpense(g, { id: "exp_6", description: "Taxi to the fort", amountMinor: 150000, paidBy: "u5", participants: ["u2", "u5"], category: "travel", splitType: "percent", splitDetails: { u2: 60, u5: 40 } });
    addExpense(g, { id: "exp_7", description: "Groceries", amountMinor: 235050, paidBy: "u2", participants: ["u1", "u2", "u3"], category: "food", splitType: "exact", splitDetails: { u1: "1000.00", u2: "850.50", u3: "500.00" } });
    addExpense(g, { id: "exp_8", description: "Club night", amountMinor: 600000, paidBy: "u3", participants: ["u1", "u2", "u3", "u5"], category: "entertainment" });
    addExpense(g, { id: "exp_9", description: "Breakfast", amountMinor: 88000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    addExpense(g, { id: "exp_10", description: "Airport cab", amountMinor: 220000, paidBy: "u2", participants: ["u1", "u2", "u3"], category: "travel", splitType: "shares", splitDetails: { u1: 1, u2: 1, u3: 1 } });
    addExpense(g, { id: "exp_11", description: "Souvenirs", amountMinor: 177500, paidBy: "u5", participants: ["u1", "u2", "u3", "u5"], category: "other" });
    addExpense(g, { id: "exp_12", description: "Lunch", amountMinor: 124000, paidBy: "u3", participants: ["u1", "u3", "u5"], category: "food" });
    addExpense(g, { id: "exp_13", description: "Farewell drinks", amountMinor: 200000, paidBy: "u1", participants: ["u1", "u2", "u3", "u5"], category: "entertainment" });

    // Expected food total: 4860.00 (exp_2) + 2350.50 (exp_7) + 880.00 (exp_9) + 1240.00 (exp_12) = 9330.50
    expect(categoryTotals(g)).toContainEqual({ category: "food", totalMinor: 933050 });
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

  it("[QP-QUIKSPL-136-2] Member 'Paid' summary excludes a deleted expense", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Paid by A", amountMinor: 1000, paidBy: "u1", participants: ["u1"] });
    addExpense(g, { description: "Paid by B", amountMinor: 2000, paidBy: "u2", participants: ["u2"] });
    deleteExpense(g, "exp_1");
    const rows = memberSummary(g);
    const a = rows.find((r) => r.id === "u1");
    const b = rows.find((r) => r.id === "u2");
    expect(a.paidMinor).toBe(0); // u1's expense was deleted
    expect(b.paidMinor).toBe(2000);
  });

  it("[QP-QUIKSPL-136-3] Member 'Share' summary excludes a deleted expense", () => {
    const g = createGroup("g", "Test", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Shared by A and B", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"] });
    addExpense(g, { description: "Another shared by A and B", amountMinor: 2000, paidBy: "u2", participants: ["u1", "u2"] });
    deleteExpense(g, "exp_1");
    const rows = memberSummary(g);
    const a = rows.find((r) => r.id === "u1");
    const b = rows.find((r) => r.id === "u2");
    // Only the second expense (2000) is active, split evenly (1000 each)
    expect(a.owedMinor).toBe(1000);
    expect(b.owedMinor).toBe(1000);
  });
});
