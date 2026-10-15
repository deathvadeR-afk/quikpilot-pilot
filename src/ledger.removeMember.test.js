import { describe, it, expect, vi } from "vitest";
import {
  createGroup,
  addExpense,
  removeMember,
} from "./ledger.js";
import { ValidationError } from "./validation.js";

// Mock computeBalances to control its behavior for specific tests
vi.mock('./ledger.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    computeBalances: vi.fn(actual.computeBalances),
  };
});

// Import the mocked computeBalances
import { computeBalances } from './ledger.js';

describe("removeMember validation", () => {
  it("[QP-QUIKSPL-229-1] Refuses to remove member with associated expense", () => {
    const g = createGroup("g", "Weekend cricket", [{ id: "hemant", name: "Hemant" }]);
    addExpense(g, { description: "New ball", amountMinor: 500, paidBy: "hemant", participants: ["hemant"] });
    expect(() => removeMember(g, "hemant")).toThrow(ValidationError);
    expect(() => removeMember(g, "hemant")).toThrow("That member appears in expenses and cannot be removed.");
    expect(g.members.map((m) => m.id)).toContain("hemant");
  });

  it("[QP-QUIKSPL-229-2] Allows removal of member with no associated expenses and zero balance", () => {
    const g = createGroup("g", "Weekend cricket", [{ id: "alice", name: "Alice" }]);
    expect(() => removeMember(g, "alice")).not.toThrow();
    expect(g.members.map((m) => m.id)).not.toContain("alice");
  });

  it("[QP-QUIKSPL-229-3] Validation occurs before balance computation", () => {
    const g = createGroup("g", "Test Group", [{ id: "member1", name: "Member One" }]);
    addExpense(g, { description: "Test Expense", amountMinor: 100, paidBy: "member1", participants: ["member1"] });

    computeBalances.mockClear();
    expect(() => removeMember(g, "member1")).toThrow(ValidationError);
    expect(computeBalances).not.toHaveBeenCalled();
  });
});