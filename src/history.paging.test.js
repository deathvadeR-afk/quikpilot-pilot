import { describe, it, expect } from 'vitest';
import { addExpense, createGroup } from './ledger.js';
import { listExpenses } from './history.js';

function twelve() {
  const g = createGroup('g', 'Twelve', [
    { id: 'u1', name: 'A' },
    { id: 'u2', name: 'B' },
  ]);
  for (let i = 1; i <= 12; i++) {
    addExpense(g, {
      description: `Expense ${i}`,
      amountMinor: 100,
      paidBy: 'u1',
      participants: ['u1', 'u2'],
      category: 'food',
      createdAt: `2026-10-${String(i).padStart(2, '0')}T09:00:00.000Z`,
    });
  }
  return g;
}

describe('listExpenses paging with 12 expenses', () => {
  it('[QP-QUIKSPL-283-1] Page 1 shows exactly 10 expenses when 12 exist and the page size is 10', () => {
    const result = listExpenses(twelve(), { page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(10);
  });

  it('[QP-QUIKSPL-283-2] The 11th expense does not repeat at the top of page 2', () => {
    const g = twelve();
    const page1 = listExpenses(g, { page: 1, pageSize: 10 }).items.map((e) => e.id);
    const page2 = listExpenses(g, { page: 2, pageSize: 10 }).items.map((e) => e.id);
    expect(page2.filter((id) => page1.includes(id))).toEqual([]);
  });

  it('[QP-QUIKSPL-283-3] Paging through all expenses returns each of the 12 exactly once', () => {
    const g = twelve();
    const all = [];
    for (let page = 1; page <= 2; page++) {
      all.push(...listExpenses(g, { page, pageSize: 10 }).items.map((e) => e.id));
    }
    expect(all).toHaveLength(12);
    expect(new Set(all).size).toBe(12);
  });
});
