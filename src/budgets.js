import { isActive } from "./ledger.js";

/**
 * Category budgets for a group. Spend is the sum of the category's live
 * expenses created in one UTC calendar month, in base-currency minor units.
 * Payments between members are not expenses, so they are never counted.
 */

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The current UTC month as YYYY-MM. */
export function currentMonth(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

export function isValidMonth(month) {
  return typeof month === "string" && MONTH_PATTERN.test(month);
}

function monthBounds(month) {
  const [year, mon] = month.split("-").map(Number);
  return { start: Date.UTC(year, mon - 1, 1), end: Date.UTC(year, mon, 1) };
}

/** Total live expenses in `category` created within the UTC month `month`. */
export function spentInMonth(group, category, month) {
  const { start, end } = monthBounds(month);
  return group.expenses
    .filter(isActive)
    .filter((e) => (e.category ?? "other") === category)
    .filter((e) => {
      const created = Date.parse(e.createdAt);
      return created >= start && created < end;
    })
    .reduce((sum, e) => sum + e.amountMinor, 0);
}

/** over-budget when spent exceeds the budget, nearly-there when spent is at least 80% of it, normal otherwise. */
export function budgetStatus(budgetMinor, spentMinor) {
  if (spentMinor > budgetMinor) return "over-budget";
  if (spentMinor * 5 >= budgetMinor * 4) return "nearly-there";
  return "normal";
}

/** One row per budget that applies to `month` (it starts on or before it). */
export function budgetRows(group, budgets, month) {
  return budgets
    .filter((b) => b.startMonth <= month)
    .map((b) => {
      const spentMinor = spentInMonth(group, b.category, month);
      return {
        category: b.category,
        startMonth: b.startMonth,
        budgetMinor: b.amountMinor,
        spentMinor,
        leftMinor: Math.max(0, b.amountMinor - spentMinor),
        status: budgetStatus(b.amountMinor, spentMinor),
      };
    });
}
