import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addExpense, createGroup } from "./ledger.js";
import { listExpenses } from "./history.js";

const here = dirname(fileURLToPath(import.meta.url));
const pageHtml = readFileSync(resolve(here, "../public/index.html"), "utf8");

// The page size the expenses page sends when no size is chosen.
function defaultPageSizeOfExpensesPage() {
  const match = pageHtml.match(/const PAGE_SIZE = (\d+);/);
  if (!match) throw new Error("PAGE_SIZE constant not found in public/index.html");
  return Number(match[1]);
}

describe("expenses page", () => {
  it("[QP-QUIKSPL-398-1] Shows 20 expenses on the first page of the expenses page by default", () => {
    const g = createGroup("g", "Quiksplit", [{ id: "u1", name: "A" }]);
    for (let i = 0; i < 25; i++) {
      addExpense(g, {
        description: `Item ${i}`,
        amountMinor: 100,
        paidBy: "u1",
        participants: ["u1"],
        category: "food",
        createdAt: `2026-10-01T09:${String(i).padStart(2, "0")}:00.000Z`,
      });
    }
    const result = listExpenses(g, { page: 1, pageSize: defaultPageSizeOfExpensesPage() });
    expect(result.items).toHaveLength(20);
  });
});
