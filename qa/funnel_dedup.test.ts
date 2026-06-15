/**
 * Verifies the funnel dedup migration (A.5.2).
 *
 * The DB enforces a unique constraint on (event_name, report_id)
 * for payment_success events. The webhook and the client both
 * fire this event; the unique constraint prevents double-counting.
 *
 * This test does NOT hit a live DB. It asserts the migration file
 * contains the expected unique index, so a founder running the
 * migration on production gets the right dedup behavior.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "infra/supabase/migrations/014_dedup_payment_event.sql"
);

describe("A.5.2 funnel dedup migration", () => {
  it("exists at the expected path", () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
  });

  it("declares a unique index on (event_name, report_id) for payment_success", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf8");
    expect(sql).toMatch(/CREATE UNIQUE INDEX/i);
    expect(sql).toMatch(/\(event_name,\s*report_id\)/);
    expect(sql).toMatch(/payment_success/);
  });

  it("uses a partial WHERE clause so non-payment events remain unconstrained", () => {
    // Otherwise, a single (event_name, report_id) pair like
    // (preview_view, null) would only allow 1 row, which is wrong —
    // we want preview_view to fire many times per report (e.g. on
    // subsequent visits). Only payment_success is deduped.
    const sql = fs.readFileSync(MIGRATION_PATH, "utf8");
    expect(sql).toMatch(/WHERE\s+event_name\s+IN/i);
  });
});
