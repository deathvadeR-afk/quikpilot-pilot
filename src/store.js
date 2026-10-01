import { createGroup } from "./ledger.js";
import { ValidationError } from "./validation.js";

/** In-memory store. One process, one dataset — this is a pilot application. */
const groups = new Map();

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
    createdAt: new Date().toISOString(),
  });
  groups.set(trip.id, trip);

  const flat = createGroup("g2", "Flat 3B", [
    { id: "u1", name: "Aditi" },
    { id: "u4", name: "Devika" },
  ]);
  groups.set(flat.id, flat);
  return groups;
}

export function listGroups() {
  return [...groups.values()];
}

export function getGroup(id) {
  return groups.get(id) ?? null;
}

seed();
