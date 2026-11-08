import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const html = readFileSync(fileURLToPath(new URL("../public/index.html", import.meta.url)), "utf8");

describe("history view", () => {
  it("[QP-QUIKSPL-346-2] requests 20 expenses per page when the history view loads with no page size chosen", () => {
    const constMatch = html.match(/const PAGE_SIZE = (\d+);/);
    expect(constMatch).not.toBeNull();
    expect(Number(constMatch[1])).toBe(20);

    const start = html.indexOf("async function loadHistory(");
    expect(start).toBeGreaterThan(-1);
    const body = html.slice(start, start + 400);
    expect(body).toMatch(/if \(reset\) \{ page = 1;/);
    expect(body).toMatch(/page,\s*pageSize: PAGE_SIZE/);
  });
});
