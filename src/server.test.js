import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { once } from "node:events";
import { app } from "./server.js";
import { getGroup, seed } from "./store.js";

let server;
let base;

beforeEach(async () => {
  seed();
  server = app.listen(0);
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => new Promise((resolve) => server.close(resolve)));

function expenseIn(groupId, expenseId) {
  return getGroup(groupId).expenses.find((e) => e.id === expenseId);
}

describe("restore route", () => {
  it("[QP-QUIKS-11-17] restores an expense through the POST restore route", async () => {
    expect(expenseIn("g1", "exp_4").deletedAt).toBeTruthy();
    await fetch(`${base}/api/groups/g1/expenses/exp_4/restore`, { method: "POST" });
    expect(expenseIn("g1", "exp_4").deletedAt).toBeFalsy();
  });

  it("[QP-QUIKS-11-18] the restore route hands the restore to restoreExpense in the ledger", async () => {
    expect(expenseIn("g1", "exp_4").deletedAt).toBeTruthy();
    await fetch(`${base}/api/groups/g1/expenses/exp_4/restore`, { method: "POST" });
    expect(expenseIn("g1", "exp_4").deletedAt).toBeFalsy();
  });
});
