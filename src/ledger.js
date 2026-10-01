import { splitEvenly } from "./money.js";
import { ValidationError } from "./validation.js";

/**
 * A group's ledger. Expenses go in; who-owes-whom comes out.
 *
 * Balances are held in integer minor units and MUST sum to zero across the
 * group — every unit one person is owed is a unit another person owes. A
 * non-zero sum means money was created or destroyed, which is why
 * `assertBalanced` exists rather than a comment asking people to be careful.
 */

export function createGroup(id, name, members) {
  return { id, name, members, expenses: [] };
}

export function addExpense(group, expense) {
  if (expense.amountMinor < 0) {
    throw new ValidationError("amount", "Negative numbers are not allowed");
  }
  const entry = { id: `exp_${group.expenses.length + 1}`, ...expense, createdAt: new Date().toISOString() };
  group.expenses.push(entry);
  return entry;
}

/**
 * Net position per member, in minor units.
 * Positive = the group owes them. Negative = they owe the group.
 */
export function computeBalances(group) {
  const balances = Object.fromEntries(group.members.map((m) => [m.id, 0]));

  for (const exp of group.expenses) {
    const shares = splitEvenly(exp.amountMinor, exp.participants.length);
    exp.participants.forEach((memberId, i) => {
      balances[memberId] -= shares[i];
    });
    balances[exp.paidBy] += exp.amountMinor;
  }

  return balances;
}

/** A ledger that does not sum to zero has lost or invented money. */
export function assertBalanced(balances) {
  const total = Object.values(balances).reduce((a, b) => a + b, 0);
  if (total !== 0) {
    throw new Error(`Ledger does not balance: net ${total} minor units unaccounted for.`);
  }
  return true;
}

/**
 * Reduce balances to a concrete list of payments.
 * Greedy largest-debtor-to-largest-creditor: not provably minimal, but it
 * terminates, it is explicable to a user, and every payment is one a person
 * would actually recognise.
 */
export function settleUp(balances) {
  const debtors = [];
  const creditors = [];

  for (const [id, amount] of Object.entries(balances)) {
    if (amount < 0) debtors.push({ id, amount: -amount });
    else if (amount > 0) creditors.push({ id, amount });
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const payments = [];
  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const pay = Math.min(debtors[d].amount, creditors[c].amount);
    payments.push({ from: debtors[d].id, to: creditors[c].id, amountMinor: pay });
    debtors[d].amount -= pay;
    creditors[c].amount -= pay;
    if (debtors[d].amount === 0) d++;
    if (creditors[c].amount === 0) c++;
  }

  return payments;
}
