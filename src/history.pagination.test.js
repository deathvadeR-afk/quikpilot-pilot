import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

const bigGroup = (count) => {
  const g = createGroup("big", "Big", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
  ]);
  for (let i = 0; i < count; i++) {
    addExpense(g, {
      description: `Item ${i}`,
      amountMinor: 100,
      paidBy: "u1",
      participants: ["u1", "u2"],
      category: "food",
      createdAt: new Date(Date.UTC(2026, 9, 1) + i * 3600000).toISOString(),
    });
  }
  return g;
};

const pageIds = (g, page, pageSize) => listExpenses(g, { page, pageSize }).items.map((e) => e.id);

describe("listExpenses pagination", () => {
  it("[QP-QUIKSPL-306-1] Page 1 shows exactly pageSize expenses when 12 exist", () => {
    expect(pageIds(bigGroup(12), 1, 10)).toHaveLength(10);
  });

  it("[QP-QUIKSPL-306-2] Page 2 shows the remaining expenses without repeating page 1", () => {
    const g = bigGroup(12);
    const first = pageIds(g, 1, 10);
    const second = pageIds(g, 2, 10);
    expect(second).toHaveLength(2);
    for (const id of second) expect(first).not.toContain(id);
  });

  it("[QP-QUIKSPL-306-3] No expense appears on two pages for any page size", () => {
    for (const pageSize of [1, 3, 5, 10]) {
      const g = bigGroup(12);
      const seen = [];
      for (let page = 1; page <= 20; page++) seen.push(...pageIds(g, page, pageSize));
      expect(new Set(seen).size).toBe(seen.length);
    }
  });

  it("[QP-QUIKSPL-306-4] Each page holds at most pageSize expenses", () => {
    const g = bigGroup(12);
    for (let page = 1; page <= 3; page++) {
      expect(pageIds(g, page, 10).length).toBeLessThanOrEqual(10);
    }
  });

  it("[QP-QUIKSPL-306-5] A page beyond the last returns nothing and repeats nothing", () => {
    expect(pageIds(bigGroup(12), 3, 10)).toEqual([]);
  });
});
