import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

function pagedGroup(count) {
  const g = createGroup("g", "Paging", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
  ]);
  for (let i = 1; i <= count; i++) {
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

describe("listExpenses paging", () => {
  it("[QP-QUIKSPL-279-1] Page 1 shows exactly pageSize expenses when more exist", () => {
    const result = listExpenses(pagedGroup(12), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-279-2] Page 2 shows only the expenses not on page 1", () => {
    const g = pagedGroup(12);
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    const page1Ids = page1.items.map((e) => e.id);
    expect(page2.items).toHaveLength(2);
    expect(page2.items.some((e) => page1Ids.includes(e.id))).toBe(false);
  });

  it("[QP-QUIKSPL-279-3] Pages together show every expense exactly once", () => {
    const g = pagedGroup(12);
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    const ids = [...page1.items, ...page2.items].map((e) => e.id);
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
  });

  it("[QP-QUIKSPL-279-4] A list exactly one page long shows no extra items", () => {
    const g = pagedGroup(10);
    const page1 = listExpenses(g, { page: 1, pageSize: 10 });
    const page2 = listExpenses(g, { page: 2, pageSize: 10 });
    expect(page1.items).toHaveLength(10);
    expect(page2.items).toHaveLength(0);
  });
});
