import { describe, it, expect, vi } from "vitest";
import { createGroup, addExpense, removeMember } from "./ledger.js";
import { ValidationError } from "./validation.js";

vi.mock('./ledger.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    computeBalances: vi.fn(actual.computeBalances),
  };
});

describe("removeMember validation", () => {
  it("[QP-QUIKSPL-240-1] Refuses to remove a member with active expenses", () => {
    const g = createGroup("g", "Weekend cricket", [
      { id: "hemant", name: "Hemant" },
      { id: "alice", name: "Alice" }
    ]);
    addExpense(g, { description: "new ball", amountMinor: 500, paidBy: "hemant", participants: ["hemant"] });
    expect(() => removeMember(g, "hemant")).toThrow(ValidationError);
    expect(() => removeMember(g, "hemant")).toThrow("That member appears in expenses and cannot be removed.");
    expect(g.members.map((m) => m.id)).toContain("hemant");
  });

  it("[QP-QUIKSPL-240-2] Successfully removes a member with no active expenses and zero balance", () => {
    const g = createGroup("g", "Weekend cricket", [
      { id: "hemant", name: "Hemant" },
      { id: "alice", name: "Alice" }
    ]);
    removeMember(g, "alice");
    expect(g.members.map((m) => m.id)).not.toContain("alice");
  });

  it("[QP-QUIKSPL-240-3] Validation occurs before balance computation", async () => {
    const { removeMember, addExpense, createGroup } = await import('./ledger.js');
    const { computeBalances } = await import('./ledger.js');
    const g = createGroup("g", "Weekend cricket", [
      { id: "hemant", name: "Hemant" }
    ]);
    addExpense(g, { description: "active expense", amountMinor: 1000, paidBy: "hemant", participants: ["hemant"] });
    expect(() => removeMember(g, "hemant")).toThrow(ValidationError);
    expect(computeBalances).not.toHaveBeenCalled();
  });
});
