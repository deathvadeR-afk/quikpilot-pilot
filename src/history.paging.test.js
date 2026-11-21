import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

function groupOfTwelve() {
  const g = createGroup("g12", "Twelve", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
  ]);
  for (let i = 1; i <= 12; i++) {
    addExpense(g, {
      description: `Expense ${i}`,
      amountMinor: 100,
      paidBy: "u1",
      participants: ["u1", "u2"],
      category: "food",
      createdAt: `2026-10-${String(i).padStart(2, "0")}T09:00:00.000Z`,
    });
  }
  return g;
}

describe("listExpenses", () => {
  it("[QP-QUIKSPL-422-1] page 1 holds exactly pageSize expenses when more exist", () => {
    const result = listExpenses(groupOfTwelve(), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-422-2] page 2 does not repeat an expense from page 1 at pageSize 10", () => {
    const g = groupOfTwelve();
    const page1 = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.id);
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items;
    expect(page2).toHaveLength(2);
    expect(page2.filter((e) => page1.includes(e.id))).toEqual([]);
  });

  it("[QP-QUIKSPL-422-3] a later page holds exactly pageSize expenses at pageSize 5", () => {
    const result = listExpenses(groupOfTwelve(), { page: 2, pageSize: 5 });
    expect(result.items).toHaveLength(5);
  });

  it("[QP-QUIKSPL-422-4] no expense repeats across three pages at pageSize 5", () => {
    const g = groupOfTwelve();
    const ids = [1, 2, 3].flatMap((page) => listExpenses(g, { page, pageSize: 5 }).items.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
