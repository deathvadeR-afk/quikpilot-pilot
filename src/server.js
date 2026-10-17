import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { addGroup, getGroup, listGroups } from "./store.js";
import {
  addExpense,
  addMember,
  computeBalances,
  deleteExpense,
  recordPayment,
  removeMember,
  settleUp,
  updateExpense,
} from "./ledger.js";
import { validateExpense, ValidationError, validateNonNegativeAmount } from "./validation.js";
import { BASE_CURRENCY, convertToBase } from "./exchange.js";
import { fromMinor, toMinor } from "./money.js";
import { listExpenses } from "./history.js";
import { categoryTotals, memberSummary } from "./reports.js";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3300;

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    return null;
  }
}

/** Match path segments against a pattern like "api/groups/:id/expenses". Returns the captured params or null. */
function match(pattern, parts) {
  const want = pattern.split("/");
  if (want.length !== parts.length) return null;
  const params = {};
  for (let i = 0; i < want.length; i++) {
    if (want[i].startsWith(":")) params[want[i].slice(1)] = parts[i];
    else if (want[i] !== parts[i]) return null;
  }
  return params;
}

function display(expense) {
  return {
    ...expense,
    amountDisplay: fromMinor(expense.amountMinor),
    originalDisplay: expense.original
      ? `${fromMinor(expense.original.amountMinor)} ${expense.original.currency}`
      : `${fromMinor(expense.amountMinor)} ${BASE_CURRENCY}`,
  };
}

export const app = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean);
  const method = req.method;

  try {
    if (method === "GET" && url.pathname === "/") {
      const html = await readFile(join(here, "..", "public", "index.html"), "utf8");
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(html);
    }

    if (method === "GET" && url.pathname === "/api/groups") {
      return json(res, 200, listGroups().map((g) => ({ id: g.id, name: g.name, memberCount: g.members.length })));
    }

    if (method === "POST" && url.pathname === "/api/groups") {
      const body = await readBody(req);
      if (body === null) return json(res, 400, { error: "Body must be valid JSON." });
      const group = addGroup(body.name, body.members);
      return json(res, 201, { id: group.id, name: group.name, members: group.members });
    }

    // Everything below is /api/groups/:id/...
    const base = match("api/groups/:id", parts) ?? match("api/groups/:id/:section", parts) ?? match("api/groups/:id/:section/:itemId", parts);
    if (base) {
      const group = getGroup(base.id);
      if (!group) return json(res, 404, { error: "Group not found." });

      if (!base.section && method === "GET") {
        const balances = computeBalances(group);
        return json(res, 200, {
          ...group,
          balances,
          balancesDisplay: Object.fromEntries(Object.entries(balances).map(([k, v]) => [k, fromMinor(v)])),
          settlements: settleUp(balances),
        });
      }

      if (base.section === "expenses" && !base.itemId && method === "GET") {
        const q = Object.fromEntries(url.searchParams);
        const result = listExpenses(group, q);
        return json(res, 200, { ...result, items: result.items.map(display) });
      }

      if (base.section === "expenses" && !base.itemId && method === "POST") {
        const body = await readBody(req);
        if (body === null) return json(res, 400, { error: "Body must be valid JSON." });

        const memberIds = group.members.map((m) => m.id);
        const expense = validateExpense(body, memberIds);
        validateNonNegativeAmount(expense.original.amountMinor, "amount");
        const created = addExpense(group, expense);
        return json(res, 201, display(created));
      }

      if (base.section === "expenses" && base.itemId && method === "PATCH") {
        const body = await readBody(req);
        if (body === null) return json(res, 400, { error: "Body must be valid JSON." });

        const changes = {};
        if (body.description !== undefined) changes.description = body.description;
        if (body.category !== undefined) changes.category = body.category;
        if (body.amount !== undefined) {
          const existing = group.expenses.find((e) => e.id === base.itemId);
          const originalMinor = validateNonNegativeAmount(body.amount, "amount");
          const currency = existing?.original?.currency ?? BASE_CURRENCY;
          changes.amountMinor = convertToBase(originalMinor, currency);
          changes.original = { amountMinor: originalMinor, currency };
        }
        return json(res, 200, display(updateExpense(group, base.itemId, changes)));
      }

      if (base.section === "expenses" && base.itemId && method === "DELETE") {
        deleteExpense(group, base.itemId);
        return json(res, 200, { deleted: base.itemId });
      }

      if (base.section === "payments" && !base.itemId && method === "POST") {
        const body = await readBody(req);
        if (body === null) return json(res, 400, { error: "Body must be valid JSON." });
        const amountMinor = validateNonNegativeAmount(body.amount, "amount");
        return json(res, 201, recordPayment(group, { from: body.from, to: body.to, amountMinor }));
      }

      if (base.section === "summary" && !base.itemId && method === "GET") {
        return json(res, 200, {
          categories: categoryTotals(group).map((c) => ({ ...c, totalDisplay: fromMinor(c.totalMinor) })),
          members: memberSummary(group).map((m) => ({
            ...m,
            paidDisplay: fromMinor(m.paidMinor),
            owedDisplay: fromMinor(m.owedMinor),
            balanceDisplay: fromMinor(m.balanceMinor),
          })),
        });
      }

      if (base.section === "members" && !base.itemId && method === "POST") {
        const body = await readBody(req);
        if (body === null) return json(res, 400, { error: "Body must be valid JSON." });
        return json(res, 201, addMember(group, body));
      }

      if (base.section === "members" && base.itemId && method === "DELETE") {
        removeMember(group, base.itemId);
        return json(res, 200, { removed: base.itemId });
      }
    }

    return json(res, 404, { error: "Not found." });
  } catch (err) {
    if (err instanceof ValidationError) {
      return json(res, err.status, { error: err.message, field: err.field });
    }
    console.error("Unhandled error:", err);
    return json(res, 500, { error: "Something went wrong." });
  }
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => console.log(`QuikSplit listening on http://localhost:${PORT}`));
}
