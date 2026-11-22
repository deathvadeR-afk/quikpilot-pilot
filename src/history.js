import { isActive } from "./ledger.js";

/**
 * The expense history: newest first, filterable, paged.
 *
 *   memberId   expenses the member paid for or took part in
 *   category   one category
 *   from, to   created between two moments, both ends included. Either may be
 *              a full ISO timestamp or a plain date (2026-10-03). A plain date
 *              as `to` means the whole UTC day, up to 23:59:59.999; as `from`
 *              it is midnight UTC at the start of that day. A full timestamp is compared as given, at either end.
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
  const plainDateTo = /^\d{4}-\d{2}-\d{2}$/.test(to);
  if (to) items = items.filter((e) => e.createdAt <= (plainDateTo ? `${to}T23:59:59.999Z` : to));

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
