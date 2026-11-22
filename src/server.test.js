import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { app } from "./server.js";
import { seed } from "./store.js";

let server;
let base;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  seed();
});

function restore(groupId, expenseId) {
  return fetch(`${base}/api/groups/${groupId}/expenses/${expenseId}/restore`, { method: "POST" });
}

describe("POST /api/groups/:id/expenses/:expenseId/restore", () => {
  it("[QP-QUIKSPL-424-1] restores a deleted expense and returns it", async () => {
    const res = await restore("g1", "exp_4");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("exp_4");
  });

  it("[QP-QUIKSPL-424-2] returns the restored expense with deletedAt removed and restoredAt set", async () => {
    const before = Date.now();
    const res = await restore("g1", "exp_4");
    const after = Date.now();
    const body = await res.json();
    expect(body).not.toHaveProperty("deletedAt");
    expect(body.restoredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    const at = Date.parse(body.restoredAt);
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(after);
  });

  it("[QP-QUIKSPL-424-9] refuses to restore an expense that is not deleted", async () => {
    const res = await restore("g1", "exp_1");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: "This expense is not deleted.", field: "id" });
  });

  it("[QP-QUIKSPL-424-10] refuses to restore an id that does not exist", async () => {
    const res = await restore("g1", "exp_999");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Expense not found.", field: "id" });
  });
});
