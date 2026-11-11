import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

const manyExpenses = (n) => {
  const g = createGroup("g2", "Many", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
  ]);
  for (let i = 0; i < n; i++) {
    addExpense(g, {
      description: `E${i}`,
      amountMinor: 100,
      paidBy: "u1",
      participants: ["u1", "u2"],
      category: "food",
      createdAt: new Date(Date.UTC(2026, 9, 1) + i * 3600000).toISOString(),
    });
  }
  return g;
};

describe("listExpenses paging", () => {
  it("[QP-QUIKSPL-387-1] Page 1 of 12 expenses at page size 10 shows 10 expenses and not the 11th", () => {
    const page = listExpenses(manyExpenses(12), { page: 1, pageSize: 10 }).items.map((e) => e.description);
    expect(page).toHaveLength(10);
    expect(page).not.toContain("E1");
  });

  it("[QP-QUIKSPL-387-2] Page 2 shows the remaining expenses without repeating any from page 1", () => {
    const g = manyExpenses(12);
    const first = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.description);
    const second = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.description);
    expect(second).toHaveLength(2);
    expect(second.filter((d) => first.includes(d))).toEqual([]);
  });

  it("[QP-QUIKSPL-387-3] No page exceeds the page size and no expense repeats across three pages", () => {
    const g = manyExpenses(25);
    const p1 = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.description);
    const p2 = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.description);
    const p3 = listExpenses(g, { page: 3, pageSize: 10 }).items.map((e) => e.description);
    expect(p1).toHaveLength(10);
    expect(p2).toHaveLength(10);
    expect(p3).toHaveLength(5);
    const all = [...p1, ...p2, ...p3];
    expect(new Set(all).size).toBe(all.length);
  });
});
