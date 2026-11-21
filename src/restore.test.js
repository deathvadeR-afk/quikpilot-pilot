import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { once } from "node:events";
import { app } from "./server.js";

let server;
let base;

beforeAll(async () => {
  server = app.listen(0);
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => {
  server.closeAllConnections?.();
  return new Promise((resolve) => server.close(resolve));
});

async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function groupWithExpense() {
  const g = await call("POST", "/api/groups", { name: "Restore", members: ["Ann", "Ben"] });
  const e = await call("POST", `/api/groups/${g.body.id}/expenses`, {
    description: "Dinner",
    amount: "9.00",
    paidBy: "m1",
    participants: ["m1", "m2"],
  });
  return { groupId: g.body.id, expenseId: e.body.id };
}

describe("restoring a deleted expense", () => {
  it("[QP-QUIKSPL-357-1] Restores a deleted expense with deletedAt removed and restoredAt set", async () => {
    const { groupId, expenseId } = await groupWithExpense();
    await call("DELETE", `/api/groups/${groupId}/expenses/${expenseId}`);
    const res = await call("POST", `/api/groups/${groupId}/expenses/${expenseId}/restore`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(expenseId);
    expect(res.body.deletedAt).toBeUndefined();
    expect(res.body.restoredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("[QP-QUIKSPL-357-2] Counts a restored expense in the balances again", async () => {
    const { groupId, expenseId } = await groupWithExpense();
    const before = (await call("GET", `/api/groups/${groupId}`)).body.balances;
    await call("DELETE", `/api/groups/${groupId}/expenses/${expenseId}`);
    await call("POST", `/api/groups/${groupId}/expenses/${expenseId}/restore`);
    const after = (await call("GET", `/api/groups/${groupId}`)).body.balances;
    expect(after).toEqual(before);
  });

  it("[QP-QUIKSPL-357-3] Shows a restored expense in the expense list again", async () => {
    const { groupId, expenseId } = await groupWithExpense();
    await call("DELETE", `/api/groups/${groupId}/expenses/${expenseId}`);
    await call("POST", `/api/groups/${groupId}/expenses/${expenseId}/restore`);
    const list = await call("GET", `/api/groups/${groupId}/expenses`);
    expect(list.body.items.map((e) => e.id)).toContain(expenseId);
  });

  it("[QP-QUIKSPL-357-4] Refuses to restore an expense that is not deleted", async () => {
    const { groupId, expenseId } = await groupWithExpense();
    const res = await call("POST", `/api/groups/${groupId}/expenses/${expenseId}/restore`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("This expense is not deleted.");
    expect(res.body.field).toBe("id");
  });

  it("[QP-QUIKSPL-357-5] Refuses to restore an expense id that does not exist", async () => {
    const { groupId } = await groupWithExpense();
    const res = await call("POST", `/api/groups/${groupId}/expenses/exp_999/restore`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Expense not found.");
    expect(res.body.field).toBe("id");
  });
});
