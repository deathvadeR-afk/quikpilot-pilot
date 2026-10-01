import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getGroup, listGroups } from "./store.js";
import { addExpense, computeBalances, settleUp } from "./ledger.js";
import { validateExpense, ValidationError } from "./validation.js";
import { fromMinor } from "./money.js";

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

export const app = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean);

  try {
    if (req.method === "GET" && url.pathname === "/") {
      const html = await readFile(join(here, "..", "public", "index.html"), "utf8");
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(html);
    }

    if (req.method === "GET" && url.pathname === "/api/groups") {
      return json(res, 200, listGroups().map((g) => ({ id: g.id, name: g.name, memberCount: g.members.length })));
    }

    // /api/groups/:id
    if (parts[0] === "api" && parts[1] === "groups" && parts[2] && parts.length === 3) {
      const group = getGroup(parts[2]);
      if (!group) return json(res, 404, { error: "Group not found." });
      if (req.method === "GET") {
        const balances = computeBalances(group);
        return json(res, 200, {
          ...group,
          balances,
          balancesDisplay: Object.fromEntries(Object.entries(balances).map(([k, v]) => [k, fromMinor(v)])),
          settlements: settleUp(balances),
        });
      }
    }

    // /api/groups/:id/expenses
    if (parts[0] === "api" && parts[1] === "groups" && parts[3] === "expenses" && req.method === "POST") {
      const group = getGroup(parts[2]);
      if (!group) return json(res, 404, { error: "Group not found." });

      const body = await readBody(req);
      if (body === null) return json(res, 400, { error: "Body must be valid JSON." });

      const memberIds = group.members.map((m) => m.id);
      const expense = validateExpense(body, memberIds);
      if (expense.amountMinor < 0) {
        throw new ValidationError("amount", "Negative numbers are not allowed");
      }
      const created = addExpense(group, expense);
      return json(res, 201, created);
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
