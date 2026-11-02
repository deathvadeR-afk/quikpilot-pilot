import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

function twelveGroup() {
  const g = createGroup("g12", "Twelve", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
  ]);
  for (let i = 1; i <= 12; i++) {
    addExpense(g, {
      description: `E${i}`,
      amountMinor: 100,
      paidBy: "u1",
      participants: ["u1", "u2"],
      category: "food",
      createdAt: `2026-10-${String(i).padStart(2, "0")}T09:00:00.000Z`,
    });
  }
  return g;
}

describe("listExpenses pagination", () => {
  it("[QP-QUIKSPL-330-1] Shows exactly pageSize expenses on page 1 of a 12-expense list", () => {
    const result = listExpenses(twelveGroup(), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-330-2] Shows no expense on both page 1 and page 2", () => {
    const g = twelveGroup();
    const page1 = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.description);
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.description);
    expect(page1.filter((d) => page2.includes(d))).toEqual([]);
  });

  it("[QP-QUIKSPL-330-3] Shows the remaining expenses on page 2 with no repeats", () => {
    const g = twelveGroup();
    const page1 = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.description);
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.description);
    expect(page2).toHaveLength(2);
    expect(new Set([...page1, ...page2]).size).toBe(12);
    expect(page1.length + page2.length).toBe(12);
  });
});
