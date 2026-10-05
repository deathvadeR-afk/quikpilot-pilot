import { addExpense, addMember, createGroup, deleteExpense, recordPayment } from "./ledger.js";
import { ValidationError, validateExpense } from "./validation.js";

/** In-memory store. One process, one dataset — this is a pilot application. */
const groups = new Map();

/** Add an expense the way the API does (validated, converted, split), at a fixed moment. */
function seedExpense(group, raw, createdAt) {
  const validated = validateExpense(raw, group.members.map((m) => m.id));
  return addExpense(group, { ...validated, createdAt });
}

export function seed() {
  groups.clear();

  const trip = createGroup("g1", "Goa trip", [
    { id: "u1", name: "Aditi" },
    { id: "u2", name: "Bhavin" },
    { id: "u3", name: "Chirag" },
  ]);
  trip.expenses.push({
    id: "exp_1",
    description: "Beach house",
    amountMinor: 1200000,
    paidBy: "u1",
    participants: ["u1", "u2", "u3"],
    category: "stay",
    createdAt: "2026-09-26T08:00:00.000Z",
  });
  addMember(trip, { id: "u5", name: "Esha" });

  const all = ["u1", "u2", "u3", "u5"];
  seedExpense(trip, { description: "Seafood dinner", amount: "4860.00", paidBy: "u2", participants: all, category: "food" }, "2026-09-27T19:30:00.000Z");
  seedExpense(trip, { description: "Scooter rental", amount: "3200.00", paidBy: "u3", participants: all, category: "travel", splitType: "shares", splitDetails: { u1: 1, u2: 1, u3: 2, u5: 1 } }, "2026-09-27T09:00:00.000Z");
  seedExpense(trip, { description: "Duplicate dinner entry", amount: "4860.00", paidBy: "u2", participants: all, category: "food" }, "2026-09-27T19:45:00.000Z");
  deleteExpense(trip, "exp_4");
  seedExpense(trip, { description: "Water sports", amount: "120.00", currency: "USD", paidBy: "u1", participants: ["u1", "u2", "u5"], category: "entertainment" }, "2026-09-28T11:00:00.000Z");
  seedExpense(trip, { description: "Taxi to the fort", amount: "1500.00", paidBy: "u5", participants: ["u2", "u5"], category: "travel", splitType: "percent", splitDetails: { u2: 60, u5: 40 } }, "2026-09-28T22:00:00.000Z");
  seedExpense(trip, { description: "Groceries", amount: "2350.50", paidBy: "u2", participants: ["u1", "u2", "u3"], category: "food", splitType: "exact", splitDetails: { u1: "1000.00", u2: "850.50", u3: "500.00" } }, "2026-09-29T10:15:00.000Z");
  seedExpense(trip, { description: "Club night", amount: "6000.00", paidBy: "u3", participants: all, category: "entertainment" }, "2026-09-29T23:00:00.000Z");
  seedExpense(trip, { description: "Breakfast", amount: "880.00", paidBy: "u1", participants: ["u1", "u2"], category: "food" }, "2026-09-30T08:30:00.000Z");
  seedExpense(trip, { description: "Airport cab", amount: "2200.00", paidBy: "u2", participants: ["u1", "u2", "u3"], category: "travel", splitType: "shares", splitDetails: { u1: 1, u2: 1, u3: 1 } }, "2026-09-30T16:00:00.000Z");
  seedExpense(trip, { description: "Souvenirs", amount: "1775.00", paidBy: "u5", participants: all, category: "other" }, "2026-10-01T12:00:00.000Z");
  seedExpense(trip, { description: "Lunch", amount: "1240.00", paidBy: "u3", participants: ["u1", "u3", "u5"], category: "food" }, "2026-10-02T13:00:00.000Z");
  seedExpense(trip, { description: "Farewell drinks", amount: "2000.00", paidBy: "u1", participants: all, category: "entertainment" }, "2026-10-02T20:00:00.000Z");
  const paid = recordPayment(trip, { from: "u3", to: "u1", amountMinor: 100000 });
  paid.createdAt = "2026-10-01T18:00:00.000Z";
  groups.set(trip.id, trip);

  const flat = createGroup("g2", "Flat 3B", [
    { id: "u1", name: "Aditi" },
    { id: "u4", name: "Devika" },
  ]);
  seedExpense(flat, { description: "October rent", amount: "32000.00", paidBy: "u4", participants: ["u1", "u4"], category: "stay" }, "2026-10-01T06:00:00.000Z");
  groups.set(flat.id, flat);

  const cricket = createGroup("g3", "Weekend cricket", [
    { id: "u6", name: "Farhan" },
    { id: "u7", name: "Gauri" },
    { id: "u8", name: "Hemant" },
  ]);
  seedExpense(cricket, { description: "Pitch hire", amount: "1200.00", paidBy: "u6", participants: ["u6", "u7"], category: "entertainment" }, "2026-09-28T07:00:00.000Z");
  seedExpense(cricket, { description: "New ball", amount: "450.00", paidBy: "u8", participants: ["u8"], category: "other" }, "2026-09-28T07:30:00.000Z");
  groups.set(cricket.id, cricket);

  return groups;
}

export function listGroups() {
  return [...groups.values()];
}

export function getGroup(id) {
  return groups.get(id) ?? null;
}

/** Create a group from member names; ids are assigned in order (m1, m2, ...). */
export function addGroup(name, memberNames) {
  const cleanName = String(name ?? "").trim();
  if (!cleanName) throw new ValidationError("name", "A group name is required.");
  const names = Array.isArray(memberNames) ? memberNames.map((n) => String(n ?? "").trim()).filter(Boolean) : [];
  if (names.length < 2) throw new ValidationError("members", "A group needs at least two members.");

  const group = createGroup(
    `g${groups.size + 1}`,
    cleanName,
    names.map((n, i) => ({ id: `m${i + 1}`, name: n })),
  );
  groups.set(group.id, group);
  return group;
}

seed();
