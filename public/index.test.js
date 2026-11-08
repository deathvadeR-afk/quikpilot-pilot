import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "index.html"), "utf8");

describe("expenses search box", () => {
  it("[QP-QUIKSPL-345-1] shows the search box above the expense list", () => {
    const sectionStart = html.indexOf('aria-labelledby="h-exp"');
    const searchInput = html.indexOf('type="search"');
    const expenseList = html.indexOf('id="history"');
    expect(sectionStart).toBeGreaterThanOrEqual(0);
    expect(searchInput).toBeGreaterThan(sectionStart);
    expect(searchInput).toBeLessThan(expenseList);
  });
});
