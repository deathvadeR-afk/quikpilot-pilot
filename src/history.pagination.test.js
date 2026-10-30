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
      createdAt: new Date(Date.UTC(2026, 9, 1, 0, 0, i)).toISOString(),
    });
  }
  return g;
};

const descriptions = (result) => result.items.map((e) => e.description);

describe("listExpenses pagination", () => {
  it("[QP-QUIKSPL-328-1] returns exactly 10 expenses on page 1 when 12 exist and the page size is 10", () => {
    expect(listExpenses(bigGroup(12), { page: 1, pageSize: 10 }).items).toHaveLength(10);
  });

  it("[QP-QUIKSPL-328-2] returns no more expenses than the page size on a page of size 5", () => {
    expect(listExpenses(bigGroup(12), { page: 1, pageSize: 5 }).items).toHaveLength(5);
  });

  it("[QP-QUIKSPL-328-3] shares no expense between page 1 and page 2", () => {
    const g = bigGroup(12);
    const page1 = descriptions(listExpenses(g, { page: 1, pageSize: 10 }));
    const page2 = descriptions(listExpenses(g, { page: 2, pageSize: 10 }));
    expect(page2.filter((d) => page1.includes(d))).toEqual([]);
  });

  it("[QP-QUIKSPL-328-4] shows on page 2 exactly the expenses left after page 1", () => {
    const g = bigGroup(12);
    const page1 = descriptions(listExpenses(g, { page: 1, pageSize: 10 }));
    const page2 = descriptions(listExpenses(g, { page: 2, pageSize: 10 }));
    expect(page2).toHaveLength(2);
    expect(page2.every((d) => !page1.includes(d))).toBe(true);
  });
});
