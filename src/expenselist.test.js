import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "public", "index.html"), "utf8");

describe("expense list page", () => {
  it("[QP-QUIKSPL-374-2] web expense list requests and shows 20 per page by default", () => {
    const match = html.match(/PAGE_SIZE\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match[1])).toBe(20);
  });
});
