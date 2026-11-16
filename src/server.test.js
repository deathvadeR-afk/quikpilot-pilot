import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "./server.js";

let server;
let base;

beforeAll(() => new Promise((resolve) => {
  server = app.listen(0, "127.0.0.1", () => {
    base = `http://127.0.0.1:${server.address().port}`;
    resolve();
  });
}));

afterAll(() => new Promise((resolve) => {
  server.closeAllConnections?.();
  server.close(() => resolve());
}));

async function call(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** A new group with one expense in it, created through the API. */
async function setUpGroup() {
  const group = await call("POST", "/api/groups", { name: "Restore test", members: ["Asha", "Ben", "Chen"] });
  expect(group.status).toBe(201);
  const groupId = group.body.id;
  const memberIds = group.body.members.map((m) => m.id);

  const expense = await call("POST", `/api/groups/${groupId}/expenses`, {
    description: "Dinner",
    amount: "9.00",
    paidBy: memberIds[0],
    participants: memberIds,
  });
  expect(expense.status).toBe(201);
  return { groupId, memberIds, expenseId: expense.body.id };
}

async function deleteExpenseViaApi(groupId, expenseId) {
  const res = await call("DELETE", `/api/groups/${groupId}/expenses/${expenseId}`);
  expect(res.status).toBe(200);
}

function restorePath(groupId, expenseId) {
  return `/api/groups/${groupId}/expenses/${expenseId}/restore`;
}

describe("POST /api/groups/:id/expenses/:expenseId/restore", () => {
  it("[QP-QUIKSPL-405-1] returns 200 with the restored expense in display form", async () => {
    const { groupId, expenseId } = await setUpGroup();
    await deleteExpenseViaApi(groupId, expenseId);

    const res = await call("POST", restorePath(groupId, expenseId));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(expenseId);
    expect(res.body.amountDisplay).toBeTypeOf("string");
    expect(res.body.originalDisplay).toBeTypeOf("string");
  });

  it("[QP-QUIKSPL-405-2] removes deletedAt from the restored expense", async () => {
    const { groupId, expenseId } = await setUpGroup();
    await deleteExpenseViaApi(groupId, expenseId);

    const res = await call("POST", restorePath(groupId, expenseId));
    expect(res.status).toBe(200);
    expect("deletedAt" in res.body).toBe(false);
  });

  it("[QP-QUIKSPL-405-3] sets restoredAt to the time of the restore", async () => {
    const { groupId, expenseId } = await setUpGroup();
    await deleteExpenseViaApi(groupId, expenseId);

    const before = Date.now();
    const res = await call("POST", restorePath(groupId, expenseId));
    const after = Date.now();
    expect(res.status).toBe(200);
    expect(res.body.restoredAt).toBeTypeOf("string");
    expect(new Date(res.body.restoredAt).toISOString()).toBe(res.body.restoredAt);
    const restoredAt = Date.parse(res.body.restoredAt);
    expect(restoredAt).toBeGreaterThanOrEqual(before);
    expect(restoredAt).toBeLessThanOrEqual(after);
  });

  it("[QP-QUIKSPL-405-4] puts the restored expense back into the balances", async () => {
    const { groupId, expenseId } = await setUpGroup();
    const balancesBefore = (await call("GET", `/api/groups/${groupId}`)).body.balances;
    await deleteExpenseViaApi(groupId, expenseId);

    const res = await call("POST", restorePath(groupId, expenseId));
    expect(res.status).toBe(200);

    const balancesAfter = (await call("GET", `/api/groups/${groupId}`)).body.balances;
    expect(balancesAfter).toEqual(balancesBefore);
  });

  it("[QP-QUIKSPL-405-5] shows the restored expense in the expense list again", async () => {
    const { groupId, expenseId } = await setUpGroup();
    await deleteExpenseViaApi(groupId, expenseId);

    const res = await call("POST", restorePath(groupId, expenseId));
    expect(res.status).toBe(200);

    const list = await call("GET", `/api/groups/${groupId}/expenses`);
    expect(list.body.items.map((e) => e.id)).toContain(expenseId);
  });

  it("[QP-QUIKSPL-405-6] refuses to restore an expense that is not deleted", async () => {
    const { groupId, expenseId } = await setUpGroup();

    const res = await call("POST", restorePath(groupId, expenseId));
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "This expense is not deleted.", field: "id" });
  });

  it("[QP-QUIKSPL-405-7] refuses to restore an expense id that does not exist", async () => {
    const { groupId } = await setUpGroup();

    const res = await call("POST", restorePath(groupId, "exp_missing"));
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Expense not found.", field: "id" });
  });
});
