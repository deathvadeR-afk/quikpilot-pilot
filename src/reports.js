import { computeBalances } from "./ledger.js";
import { computeShares } from "./splits.js";

/**
 * Read-only views over a group's ledger: spend by category, and what each
 * member has put in and taken out. All amounts are integer base-currency minor
 * units.
 */

/** Total spend per category, largest first. */
export function categoryTotals(group) {
  const totals = {};
  for (const exp of group.expenses) {
    const category = exp.category ?? "other";
    totals[category] = (totals[category] ?? 0) + exp.amountMinor;
  }
  return Object.entries(totals)
    .map(([category, totalMinor]) => ({ category, totalMinor }))
    .sort((a, b) => b.totalMinor - a.totalMinor || a.category.localeCompare(b.category));
}

/**
 * Per member: what they paid out, what their share of the group's expenses
 * came to, and where they stand after any payments between members.
 */
export function memberSummary(group) {
  const balances = computeBalances(group);
  const summary = Object.fromEntries(
    group.members.map((m) => [m.id, { id: m.id, name: m.name, paidMinor: 0, owedMinor: 0, balanceMinor: balances[m.id] }]),
  );

  for (const exp of group.expenses) {
    const shares = computeShares(exp);
    summary[exp.paidBy].paidMinor += exp.amountMinor;
    exp.participants.forEach((memberId, i) => {
      summary[memberId].owedMinor += shares[i];
    });
  }

  return Object.values(summary);
}
