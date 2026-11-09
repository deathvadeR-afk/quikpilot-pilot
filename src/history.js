import { isActive, isRecentlyDeleted } from "./ledger.js";
import { ValidationError } from "./validation.js";

/**
 * The expense history: newest first, filterable, paged.
 *
 *   memberId   expenses the member paid for or took part in
 *   category   one category
 *   from, to   created between two moments, both ends included. Either may be
 *              a full ISO timestamp or a plain date (2026-10-03), and a plain
 *              date means that whole day.
 *   page       1-based
 *   pageSize   at most 50
 */
export const MAX_PAGE_SIZE = 50;

export function listExpenses(group, options = {}) {
  const { memberId, category, from, to } = options;
  const page = Math.max(1, Math.floor(Number(options.page) || 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(options.pageSize) || 10)));

  let items = group.expenses.filter(isActive);
  if (memberId) items = items.filter((e) => e.paidBy === memberId || e.participants.includes(memberId));
  if (category) items = items.filter((e) => e.category === category);
  if (from) items = items.filter((e) => e.createdAt >= from);
  if (to) items = items.filter((e) => e.createdAt <= to);

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return {
    items: items.slice(start, end + 1),
    page,
    pageSize,
    total: items.length,
    hasMore: end < items.length,
  };
}

/** Expenses deleted within the restore window. Only members of the group may see them. */
export function listRecentlyDeleted(group, userId) {
  assertMember(group, userId);
  const items = group.expenses
    .filter((e) => isRecentlyDeleted(e))
    .map((e) => ({
      id: e.id,
      description: e.description,
      originalDate: e.createdAt,
      deletedBy: e.deletedBy ?? null,
      deletedAt: e.deletedAt,
    }));
  return { items, total: items.length };
}

/**
 * Put a recently deleted expense back in the history. Refused for non-members,
 * for expenses that are active, and for expenses deleted outside the window.
 */
export function restoreExpense(group, id, userId) {
  assertMember(group, userId);
  const expense = group.expenses.find((e) => e.id === id);
  if (!expense) throw new ValidationError("id", "Expense not found.");
  if (isActive(expense)) throw new ValidationError("id", "This expense is not deleted.");
  if (!isRecentlyDeleted(expense)) {
    throw new ValidationError("id", "This expense was deleted more than 30 days ago and can no longer be restored.");
  }
  delete expense.deletedAt;
  delete expense.deletedBy;
  return expense;
}

function assertMember(group, userId) {
  if (!group.members.some((m) => m.id === userId)) {
    throw new ValidationError("memberId", "Only members of this group can do that.");
  }
}
