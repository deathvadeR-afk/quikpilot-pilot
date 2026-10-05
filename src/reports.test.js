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
});
