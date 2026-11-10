import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "./server.js";
import { addGroup } from "./store.js";
import { addExpense, recordPayment } from "./ledger.js";

let server;
let base;

beforeAll(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

/** Send a request as the given member id, sent in the x-user-id header. */
async function call(method, path, { user = "m1", body } = {}) {
  const headers = { "Content-Type": "application/json", "x-user-id": user };
  const res = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, body: json, text };
}

function newGroup() {
  return addGroup("Flat", ["Asha", "Ben", "Chen"]);
}

function addFood(group, amountMinor, createdAt, deletedAt) {
  return addExpense(group, {
    description: "Food",
    amountMinor,
    paidBy: "m1",
    participants: ["m1"],
    category: "food",
    createdAt,
    deletedAt,
  });
}

function findRow(body, category) {
  return body?.budgets?.find((r) => r.category === category);
}

function setBudget(groupId, category, amount, { month = "2026-11", user = "m1" } = {}) {
  return call("PUT", `/api/groups/${groupId}/budgets`, { user, body: { category, amount, month } });
}

function viewMonth(groupId, month, user = "m1") {
  return call("GET", `/api/groups/${groupId}/budgets?month=${month}`, { user });
}

describe("group budgets", () => {
  it("[QP-QUIKSPL-378-1] Shows the Budgets section with the month picker, form and budgeted category rows", async () => {
    const group = newGroup();
    await setBudget(group.id, "food", "5000.00");
    const html = await (await fetch(base + "/")).text();
    expect(html).toContain("Budgets");
    expect(html).toMatch(/type="month"/);
  });

  it("[QP-QUIKSPL-378-4] Refuses a budget for a category that is not in the group", async () => {
    const group = newGroup();
    const put = await setBudget(group.id, "Gadgets", "100.00");
    expect(put.status).toBeGreaterThanOrEqual(400);
    const after = await viewMonth(group.id, "2026-11");
    expect(after.text.toLowerCase()).not.toContain("gadgets");
  });

  it("[QP-QUIKSPL-378-5] A budget set in one month applies to later months until cleared", async () => {
    const group = newGroup();
    await setBudget(group.id, "food", "5000.00", { month: "2026-10" });

    const before = await viewMonth(group.id, "2026-11");
    expect(before.status).toBe(200);
    expect(findRow(before.body, "food")?.budgetDisplay).toBe("5000.00");

    const clear = await setBudget(group.id, "food", null, { month: "2026-11" });
    expect(clear.status).toBeLessThan(300);

    const after = await viewMonth(group.id, "2026-11");
    expect(after.status).toBe(200);
    expect(findRow(after.body, "food")).toBeUndefined();
  });

  it("[QP-QUIKSPL-378-6] Any member can set or clear a budget", async () => {
    const group = newGroup();
    const set = await setBudget(group.id, "food", "800.00", { user: "m2" });
    expect(set.status).toBeLessThan(300);
    const seen = await viewMonth(group.id, "2026-11", "m1");
    expect(findRow(seen.body, "food")?.budgetDisplay).toBe("800.00");

    const clear = await setBudget(group.id, "food", null, { user: "m2" });
    expect(clear.status).toBeLessThan(300);
    const gone = await viewMonth(group.id, "2026-11", "m1");
    expect(findRow(gone.body, "food")).toBeUndefined();
  });

  it("[QP-QUIKSPL-378-7] Spent counts only the category's live expenses created in that month, in base currency", async () => {
    const group = newGroup();
    await setBudget(group.id, "food", "1000.00");
    addFood(group, 40000, "2026-10-31T23:30:00.000Z");
    addFood(group, 25000, "2026-11-01T00:10:00.000Z");
    addFood(group, 30000, "2026-11-15T00:00:00.000Z");
    addFood(group, 10000, "2026-11-05T12:00:00.000Z", "2026-11-06T00:00:00.000Z");
    const payment = recordPayment(group, { from: "m2", to: "m1", amountMinor: 9000 });
    payment.createdAt = "2026-11-05T12:00:00.000Z";

    const res = await viewMonth(group.id, "2026-11");
    expect(res.status).toBe(200);
    const row = findRow(res.body, "food");
    expect(row?.spentDisplay).toBe("550.00");
    expect(row?.leftDisplay).toBe("450.00");
  });

  it("[QP-QUIKSPL-378-8] Over-budget row is red and shows the excess", async () => {
    const group = newGroup();
    await setBudget(group.id, "food", "500.00");
    addFood(group, 65000, "2026-11-03T10:00:00.000Z");

    const res = await viewMonth(group.id, "2026-11");
    expect(findRow(res.body, "food")?.status).toBe("over-budget");
    const html = await (await fetch(base + "/")).text();
    expect(html).toContain("Over by");
  });

  it("[QP-QUIKSPL-378-9] Spend at exactly 80% of budget shows nearly there", async () => {
    const group = newGroup();
    await setBudget(group.id, "food", "1000.00");
    addFood(group, 80000, "2026-11-03T10:00:00.000Z");

    const res = await viewMonth(group.id, "2026-11");
    const row = findRow(res.body, "food");
    expect(row?.status).toBe("nearly-there");
    expect(row?.status).not.toBe("over-budget");
  });

  it("[QP-QUIKSPL-378-10] Left shows zero when spend exceeds the budget", async () => {
    const group = newGroup();
    await setBudget(group.id, "food", "500.00");
    addFood(group, 65000, "2026-11-03T10:00:00.000Z");

    const res = await viewMonth(group.id, "2026-11");
    expect(findRow(res.body, "food")?.leftDisplay).toBe("0.00");
  });

  it("[QP-QUIKSPL-378-11] Server refuses an invalid budget sent directly to the API", async () => {
    const group = newGroup();
    const put = await setBudget(group.id, "food", "-1");
    expect(put.status).toBeGreaterThanOrEqual(400);
    expect(put.body?.error).toBeTruthy();
    const after = await viewMonth(group.id, "2026-11");
    expect(findRow(after.body, "food")).toBeUndefined();
  });

  it("[QP-QUIKSPL-378-12] A non-member cannot read or change a group's budgets", async () => {
    const group = newGroup();
    await setBudget(group.id, "food", "5000.00");

    const read = await viewMonth(group.id, "2026-11", "outsider");
    expect(read.status).toBeGreaterThanOrEqual(400);
    expect(read.text).not.toContain("5000.00");

    const put = await setBudget(group.id, "food", "100.00", { user: "outsider" });
    expect(put.status).toBeGreaterThanOrEqual(400);

    const seen = await viewMonth(group.id, "2026-11", "m1");
    expect(findRow(seen.body, "food")?.budgetDisplay).toBe("5000.00");
  });
});
