/**
 * Verifies the A.5.3 docs exist and have non-trivial content.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const DOCS = [
  "infra/docs/DEPLOY.md",
  "infra/docs/RUNBOOK.md",
  "infra/docs/FAQ.md",
];

describe("A.5.3 documentation", () => {
  for (const doc of DOCS) {
    it(`${doc} exists and has content`, () => {
      const fullPath = path.join(process.cwd(), doc);
      expect(fs.existsSync(fullPath), `${doc} should exist`).toBe(true);
      const content = fs.readFileSync(fullPath, "utf8");
      expect(content.length, `${doc} should be > 500 chars`).toBeGreaterThan(500);
    });
  }

  it("RUNBOOK.md covers at least 5 incident scenarios", () => {
    const runbook = fs.readFileSync(
      path.join(process.cwd(), "infra/docs/RUNBOOK.md"),
      "utf8"
    );
    // Look for "## N." section headers — at least 5 of them
    const matches = runbook.match(/^## \d+\./gm) ?? [];
    expect(matches.length, "should have at least 5 numbered scenarios").toBeGreaterThanOrEqual(5);
  });

  it("FAQ.md answers at least 10 buyer questions", () => {
    const faq = fs.readFileSync(
      path.join(process.cwd(), "infra/docs/FAQ.md"),
      "utf8"
    );
    const matches = faq.match(/^## \d+\./gm) ?? [];
    expect(matches.length, "should have at least 10 numbered Q&As").toBeGreaterThanOrEqual(10);
  });
});
