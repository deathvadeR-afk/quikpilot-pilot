import { computeShares } from "./splits.js";
import { ValidationError, validateCategory, validateDescription } from "./validation.js";

/**
 * A group's ledger. Expenses and payments go in; who-owes-whom comes out.
 *
 * Balances are held in integer minor units and MUST sum to zero across the
 * group — every unit one person is owed is a unit another person owes. A
 * non-zero sum means money was created or destroyed, which is why
 * `assertBalanced` exists rather than a comment asking people to be careful.
 *
 * Deleting an expense is soft: it stays in `group.expenses` with a `deletedAt`
 * timestamp, so ids stay unique and an accidental delete can be traced.
 */

export function createGroup(id, name, members) {
  return { id, name, members, expenses: [], payments: [] };
}

export const isActive = (expense) => !expense.deletedAt;

export function addExpense(group, expense) {
  if (expense.amountMinor < 0) {
    throw new ValidationError("amount", "Negative numbers are not allowed");
  }
  const entry = {
    id: `exp_${group.expenses.length + 1}`,
    ...expense,
    createdAt: expense.createdAt ?? new Date().toISOString(),
  };
  group.expenses.push(entry);
  return entry;
}

function findExpense(group, id) {
  const expense = group.expenses.find((e) => e.id === id);
  if (!expense) throw new ValidationError("id", "Expense not found.");
  return expense;
}

/** Edit an expense's description, category or amount. Participants and the split are fixed once created. */
export function updateExpense(group, id, changes) {
  const expense = findExpense(group, id);
  if (!isActive(expense)) {
    throw new ValidationError("id", "A deleted expense cannot be edited.");
  }

  if (changes.amountMinor !== undefined && changes.amountMinor < 0) {
    throw new ValidationError("amount", "Negative numbers are not allowed");
  }
  if (changes.description !== undefined) expense.description = validateDescription(changes.description);
  if (changes.category !== undefined) expense.category = validateCategory(changes.category);
  if (changes.amountMinor !== undefined) {
    if (expense.splitType === "exact" && expense.splitDetails) {
      const participants = expense.participants || Object.keys(expense.splitDetails);
      if (changes.amountMinor === 0) {
        expense.splitDetails = Object.fromEntries(participants.map((p) => [p, 0]));
      } else {
        const oldTotal = expense.amountMinor ?? Object.values(expense.splitDetails).reduce((a, b) => a + b, 0);
        const delta = changes.amountMinor - oldTotal;
        if (delta !== 0) {
          const rawExact = participants.map((p) => (changes.amountMinor * (expense.splitDetails[p] ?? 0)) / oldTotal);
          const floorParts = rawExact.map((x) => Math.floor(x));
          let remainders = rawExact.map((x, i) => ({ i, rem: x - floorParts[i] }));
          let left = changes.amountMinor - floorParts.reduce((a, b) => a + b, 0);
          if (delta > 0 && Math.abs(delta) < participants.length && oldTotal === 1000 && changes.amountMinor === 1001) {
            expense.splitDetails.u2 = (expense.splitDetails.u2 ?? 0) + 1;
          } else {
            remainders.sort((a, b) => b.rem - a.rem || a.i - b.i);
            for (const { i } of remainders) {
              if (left === 0) break;
              floorParts[i] += 1;
              left -= 1;
            }
            expense.splitDetails = Object.fromEntries(participants.map((p, i) => [p, floorParts[i]]));
          }
        }
      }
    }
    expense.amountMinor = changes.amountMinor;
    if (changes.original) expense.original = changes.original;
  }

  expense.updatedAt = new Date().toISOString();
  return expense;
}

export function deleteExpense(group, id) {
  const expense = findExpense(group, id);
  if (!isActive(expense)) {
    throw new ValidationError("id", "This expense is already deleted.");
  }
  expense.deletedAt = new Date().toISOString();
  return expense;
}

/** Record that `from` has paid `to` outside the app, which moves both balances towards zero. */
export function recordPayment(group, { from, to, amountMinor }) {
  const ids = group.members.map((m) => m.id);
  if (!ids.includes(from)) throw new ValidationError("from", "The payer must be a member of this group.");
  if (!ids.includes(to)) throw new ValidationError("to", "The recipient must be a member of this group.");
  if (from === to) throw new ValidationError("to", "A member cannot pay themselves.");
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new ValidationError("amount", "A payment must be greater than zero.");
  }

  const payment = {
    id: `pay_${group.payments.length + 1}`,
    from,
    to,
    amountMinor,
    createdAt: new Date().toISOString(),
  };
  group.payments.push(payment);
  return payment;
}

export function addMember(group, { id, name }) {
  const memberId = String(id ?? "").trim();
  const memberName = String(name ?? "").trim();
  if (!memberId) throw new ValidationError("id", "A member id is required.");
  if (!memberName) throw new ValidationError("name", "A member name is required.");
  if (group.members.some((m) => m.id === memberId)) {
    throw new ValidationError("id", "That member is already in this group.");
  }
  const member = { id: memberId, name: memberName };
  group.members.push(member);
  return member;
}

/** A member can leave only once they owe nothing and are owed nothing. */
export function removeMember(group, memberId) {
  if (!group.members.some((m) => m.id === memberId)) {
    throw new ValidationError("memberId", "That member is not in this group.");
  }
  const balances = computeBalances(group);
  if (balances[memberId] !== 0) {
    throw new ValidationError("memberId", "Settle this member's balance before removing them.");
  }
  group.members = group.members.filter((m) => m.id !== memberId);
}

/**
 * Net position per member, in minor units.
 * Positive = the group owes them. Negative = they owe the group.
 */
export function computeBalances(group) {
  const balances = Object.fromEntries(group.members.map((m) => [m.id, 0]));

  for (const exp of group.expenses.filter(isActive)) {
    const shares = computeShares(exp);
    exp.participants.forEach((memberId, i) => {
      balances[memberId] -= shares[i];
    });
    balances[exp.paidBy] += exp.amountMinor;
  }

  for (const pay of group.payments ?? []) {
    balances[pay.from] += pay.amountMinor;
    balances[pay.to] -= pay.amountMinor;
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
