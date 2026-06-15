/**
 * Verifies the 6 funnel events have at least one emit site in the code (A.5.2).
 *
 * The 6 events per the launch plan:
 *   1. landing_view
 *   2. preview_view
 *   3. checkout_open  (plan calls this "checkout_start")
 *   4. payment_success
 *   5. report_delivered
 *   6. feedback_submitted
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const APP_DIR = path.join(process.cwd(), "apps/web/src");

function grepEvent(name: string): string[] {
  const needle = `eventName: "${name}"`;
  const results: string[] = [];
  function walk(dir: string): boolean {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        if (walk(p)) return true;
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        const lines = fs.readFileSync(p, "utf8").split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(needle)) {
            results.push(`${p}:${i + 1}`);
            if (results.length >= 5) return true;
          }
        }
      }
    }
    return false;
  }
  walk(APP_DIR);
  return results;
}

describe("A.5.2 funnel event coverage", () => {
  const events = [
    "landing_view",
    "preview_view",
    "checkout_open",
    "payment_success",
    "report_delivered",
    "feedback_submitted",
  ];

  for (const evt of events) {
    it(`${evt} has at least one emit site in the code`, () => {
      const sites = grepEvent(evt);
      expect(sites.length, `${evt} should have an emit site`).toBeGreaterThan(0);
    });
  }

  it("all 6 events are in the ALLOWED_EVENTS whitelist in /api/track", () => {
    const trackRoute = path.join(APP_DIR, "app/api/track/route.ts");
    const contents = fs.readFileSync(trackRoute, "utf8");
    for (const evt of events) {
      expect(contents, `track route should whitelist ${evt}`).toContain(`"${evt}"`);
    }
  });

  it("payment_success is deduped (unique constraint in migration 014)", () => {
    const migrationPath = path.join(
      process.cwd(),
      "infra/supabase/migrations/014_dedup_payment_event.sql"
    );
    expect(fs.existsSync(migrationPath), "migration 014 should exist").toBe(true);
    const sql = fs.readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/CREATE UNIQUE INDEX/i);
    expect(sql).toMatch(/payment_success/);
  });
});
