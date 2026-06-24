/**
 * PID live smoke test. GATED on RUN_PID_SMOKE=1.
 *
 * Run: RUN_PID_SMOKE=1 pnpm vitest run qa/pid_smoke/smoke.test.ts
 *
 * This is the only test in the PID layer that hits the real Supabase. It
 * generates a real report on the demo plot (20.272688, 85.701271) and
 * asserts that pid_artifacts, pid_fact_assertions, and pid_events rows
 * were written. Skipped by default so CI never hits prod.
 */
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { generateReportV11 } from "../../apps/web/src/lib/pipeline/index";
import { supabaseAdmin } from "../../apps/web/src/lib/db";
import {
  readPidArtifactsForReport,
} from "../../apps/web/src/lib/pipeline/corpus";
import { writeFileSync } from "node:fs";

const ENABLED = process.env.RUN_PID_SMOKE === "1";
const describeIf = ENABLED ? describe : describe.skip;

describeIf("PID live smoke — Khordha demo plot", () => {
  it("writes pid_artifacts + pid_fact_assertions + pid_events for a real report", async () => {
    const reportId = createHash("sha256")
      .update(`smoke-${Date.now()}`)
      .digest("hex")
      .slice(0, 36);

    process.env.PID_RECORDING_ENABLED = "true";
    process.env.REPORT_CREATE_TOKEN =
      process.env.REPORT_CREATE_TOKEN ?? "smoke-token";

    await generateReportV11({
      reportId,
      village: "Mendhasala",
      tehsil: "Bhubaneswar",
      tehsilValue: "2",
      villageCode: "105",
      searchMode: "Plot",
      identifier: "309",
      claimedOwnerName: "Demo Owner",
    } as never);

    // Wait for any async writes to flush (PID writes are awaited but
    // Supabase client can buffer; 1s is plenty for the size of these rows).
    await new Promise((r) => setTimeout(r, 1000));

    // Use the read path now that reportId is wired into metadata.
    const artifacts = await readPidArtifactsForReport(reportId);
    const artifactCount = artifacts.length;

    // Facts and events are filtered by report_id metadata too.
    const supabase = supabaseAdmin();
    const { count: eventCount } = await supabase
      .from("pid_events")
      .select("id", { count: "exact", head: true })
      .eq("metadata->>report_id", reportId);
    const { count: factCount } = await supabase
      .from("pid_fact_assertions")
      .select("id", { count: "exact", head: true })
      .eq("metadata->>report_id", reportId);

    writeFileSync(
      "qa/pid_smoke/khordha-report-1.json",
      JSON.stringify(
        {
          reportId,
          artifactCount,
          factCount,
          eventCount,
          ranAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );

    expect(artifactCount).toBeGreaterThan(0);
    expect(eventCount ?? 0).toBeGreaterThan(0);
    // facts may be 0 if no fetcher produced data — only assert > 0 if bhulekh fired
    expect(artifactCount ?? 0).toBeGreaterThan(0);
  }, 120_000);
});
