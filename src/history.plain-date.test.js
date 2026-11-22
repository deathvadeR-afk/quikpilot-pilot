import { describe, it, expect } from "vitest";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

function withExpensesAt(...entries) {
  const g = createGroup("g2", "Dates", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
  ]);
  for (const [description, createdAt] of entries) {
    addExpense(g, { description, amountMinor: 100, paidBy: "u1", participants: ["u1", "u2"], category: "food", createdAt });
  }
  return g;
}

describe("listExpenses end dates", () => {
  it("[QP-QUIKSPL-429-1] includes expenses created later on a plain end date, with from set to the same day", () => {
    const g = withExpensesAt(["Farewell drinks", "2026-10-02T18:30:00.000Z"], ["Lunch", "2026-10-02T13:00:00.000Z"]);
    const result = listExpenses(g, { from: "2026-10-02", to: "2026-10-02" });
    expect(result.items.map((e) => e.description).sort()).toEqual(["Farewell drinks", "Lunch"]);
    expect(new Set(result.items.map((e) => e.id)).size).toBe(result.items.length);
  });

  it("[QP-QUIKSPL-429-2] ends a plain end date at 23:59:59.999 UTC and excludes the next day", () => {
    const g = withExpensesAt(["Last moment", "2026-10-02T23:59:59.999Z"], ["Next day", "2026-10-03T00:00:00.000Z"]);
    const result = listExpenses(g, { to: "2026-10-02" });
    expect(result.items.map((e) => e.description)).toEqual(["Last moment"]);
  });

  it("[QP-QUIKSPL-429-3] keeps a full timestamp end date inclusive at that exact moment", () => {
    const g = withExpensesAt(["At the moment", "2026-10-02T13:30:00.000Z"], ["Later that day", "2026-10-02T15:00:00.000Z"]);
    const result = listExpenses(g, { to: "2026-10-02T13:30:00.000Z" });
    expect(result.items.map((e) => e.description)).toEqual(["At the moment"]);
  });
});
