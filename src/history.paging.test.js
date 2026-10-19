import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

function pagedGroup() {
  const g = createGroup("g", "Paged", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
  ]);
  for (let i = 0; i < 12; i++) {
    addExpense(g, {
      description: `Item ${i + 1}`,
      amountMinor: 100,
      paidBy: "u1",
      participants: ["u1", "u2"],
      category: "food",
      createdAt: `2026-10-${String(i + 1).padStart(2, "0")}T09:00:00.000Z`,
    });
  }
  return g;
}

describe("listExpenses paging", () => {
  it("[QP-QUIKSPL-311-1] Page 1 shows exactly pageSize expenses when more expenses exist than fit on one page", () => {
    expect(listExpenses(pagedGroup(), { page: 1, pageSize: 10 }).items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-311-2] Page 2 shows the remaining expenses after page 1", () => {
    expect(listExpenses(pagedGroup(), { page: 2, pageSize: 10 }).items).toHaveLength(2);
  });

  it("[QP-QUIKSPL-311-3] No expense appears on both page 1 and page 2", () => {
    const g = pagedGroup();
    const page1 = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.description);
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.description);
    expect(page1.filter((d) => page2.includes(d))).toEqual([]);
  });

  it("[QP-QUIKSPL-311-4] Pages together contain every expense exactly once", () => {
    const g = pagedGroup();
    const all = [
      ...listExpenses(g, { page: 1, pageSize: 10 }).items,
      ...listExpenses(g, { page: 2, pageSize: 10 }).items,
    ].map((e) => e.description);
    expect(all).toHaveLength(12);
    expect(new Set(all).size).toBe(12);
  });
});
