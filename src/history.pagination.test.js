import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

function bigGroup(count) {
  const g = createGroup("big", "Big", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
  ]);
  for (let i = 0; i < count; i++) {
    addExpense(g, {
      description: `Item ${i + 1}`,
      amountMinor: 100,
      paidBy: "u1",
      participants: ["u1", "u2"],
      category: "food",
      createdAt: new Date(Date.UTC(2026, 9, 1, i)).toISOString(),
    });
  }
  return g;
}

describe("listExpenses pagination", () => {
  it("[QP-QUIKSPL-407-1] page 1 of 12 expenses at page size 10 shows exactly 10 expenses", () => {
    const result = listExpenses(bigGroup(12), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-407-2] page 2 shows the remaining 2 expenses and none that page 1 showed", () => {
    const g = bigGroup(12);
    const first = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.id);
    const second = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.id);
    expect(second).toHaveLength(2);
    expect(second.filter((id) => first.includes(id))).toEqual([]);
  });

  it("[QP-QUIKSPL-407-3] three pages of 25 expenses share no expense and hold 10, 10 and 5", () => {
    const g = bigGroup(25);
    const pages = [1, 2, 3].map((page) => listExpenses(g, { page, pageSize: 10 }).items.map((e) => e.id));
    expect(pages[0]).toHaveLength(10);
    expect(pages[1]).toHaveLength(10);
    expect(pages[2]).toHaveLength(5);
    const all = pages.flat();
    expect(new Set(all).size).toBe(all.length);
  });
});
