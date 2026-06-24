/**
 * PID live smoke test. GATED on RUN_PID_SMOKE=1.
 *
 * Run: RUN_PID_SMOKE=1 PID_RECORDING_ENABLED=true \
 *      pnpm vitest run qa/pid_smoke/smoke.test.ts
 *
 * This test calls `recordFetchResult` DIRECTLY with 3 crafted source-result
 * inputs to validate the Supabase write path end-to-end (pid_property,
 * pid_artifacts, pid_fact_assertions, pid_events). It does NOT run the
 * fetcher pipeline (which takes 5+ minutes against production sources).
 *
 * Expected runtime: <5 seconds. Skipped by default so CI never hits prod.
 */
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { recordFetchResult } from "../../apps/web/src/lib/pipeline/pid/record-fetch-result";
import type { MapperInput } from "../../apps/web/src/lib/pipeline/pid/mapper";
import { supabaseAdmin } from "../../apps/web/src/lib/db";
import {
  readPidArtifactsForReport,
} from "../../apps/web/src/lib/pipeline/corpus";

const ENABLED = process.env.RUN_PID_SMOKE === "1";
const describeIf = ENABLED ? describe : describe.skip;

const REPORT_BASE = {
  village: "Mendhasala",
  tahasil: "Bhubaneswar",
  district: "Khordha",
};

function nowIso(): string {
  return new Date().toISOString();
}

function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

describeIf("PID live smoke — direct recordFetchResult writes", () => {
  it("writes pid_artifacts + pid_fact_assertions + pid_events via direct calls", async () => {
    const reportId = createHash("sha256")
      .update(`smoke-${Date.now()}`)
      .digest("hex")
      .slice(0, 36);

    process.env.PID_RECORDING_ENABLED = "true";

    // Seed pid_sources — FK target for pid_artifacts, pid_fact_assertions,
    // pid_events. Idempotent (ON CONFLICT DO NOTHING).
    const seedClient = supabaseAdmin();
    const sourceIds = ["bhulekh", "bhunaksha", "nominatim"];
    await seedClient.from("pid_sources").upsert(
      sourceIds.map((sid) => ({
        source_id: sid,
        source_name: sid,
        source_category: "test",
        priority: "P2",
        source_roles: [],
        availability: "active",
        access_modes: ["bulk"],
        collection_mode: "manual",
        status: "active",
      })),
      { onConflict: "source_id", ignoreDuplicates: true },
    );

    const fetchedAt = nowIso();

    // 1) Bhulekh — artifact + tenant fact
    const bhulekh: MapperInput = {
      status: "ok",
      sourceId: "bhulekh",
      input: { ...REPORT_BASE, plotNo: "309" },
      data: {
        ...REPORT_BASE,
        plotNo: "309",
        tenants: [{ name: "Smoke Test Owner" }],
      },
      fetchedAt,
      rawArtifactHash: hash(`bhulekh-${reportId}`),
      rawArtifactPath: `smoke/${reportId}/bhulekh.html`,
      rawContentType: "text/html",
      rawByteSize: 12_345,
      rawHttpStatus: 200,
    };

    // 2) Bhunaksha — plot_number fact
    const bhunaksha: MapperInput = {
      status: "ok",
      sourceId: "bhunaksha",
      input: { ...REPORT_BASE },
      data: {
        ...REPORT_BASE,
        plotNo: "309",
      },
      fetchedAt,
    };

    // 3) Nominatim — display_name fact
    const nominatim: MapperInput = {
      status: "ok",
      sourceId: "nominatim",
      input: { ...REPORT_BASE },
      data: {
        ...REPORT_BASE,
        displayName: "Mendhasala, Odisha, India",
      },
      fetchedAt,
    };

    const r1 = await recordFetchResult("bhulekh", REPORT_BASE, bhulekh, reportId);
    const r2 = await recordFetchResult("bhunaksha", REPORT_BASE, bhunaksha, reportId);
    const r3 = await recordFetchResult("nominatim", REPORT_BASE, nominatim, reportId);

    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
    expect(r3).not.toBeNull();

    // Wait briefly for any async flush (writes are awaited but Postgres
    // replication / SDK buffering can add a small lag).
    await new Promise((r) => setTimeout(r, 1000));

    // Read-back via the production read path.
    const artifacts = await readPidArtifactsForReport(reportId);
    const artifactCount = artifacts.length;

    const supabase = supabaseAdmin();
    const { count: eventCount } = await supabase
      .from("pid_events")
      .select("id", { count: "exact", head: true })
      .eq("metadata->>report_id", reportId);
    // Facts are linked to reports via artifact_id (the mapper threads
    // report_id into artifact.metadata, not fact metadata).
    const artifactIds = artifacts.map((a) => a.id);
    const { count: factCount } =
      artifactIds.length === 0
        ? { count: 0 }
        : await supabase
            .from("pid_fact_assertions")
            .select("id", { count: "exact", head: true })
            .in("artifact_id", artifactIds);

    writeFileSync(
      "qa/pid_smoke/khordha-report-1.json",
      JSON.stringify(
        {
          reportId,
          artifactCount,
          factCount,
          eventCount,
          r1: { artifactId: r1?.artifactId, factIds: r1?.factIds, eventId: r1?.eventId, propertyId: r1?.propertyId },
          r2: { artifactId: r2?.artifactId, factIds: r2?.factIds, eventId: r2?.eventId, propertyId: r2?.propertyId },
          r3: { artifactId: r3?.artifactId, factIds: r3?.factIds, eventId: r3?.eventId, propertyId: r3?.propertyId },
          ranAt: fetchedAt,
        },
        null,
        2,
      ),
    );

    // Pid_artifacts: at least one (bhulekh had rawArtifactHash + rawArtifactPath).
    expect(artifactCount).toBeGreaterThanOrEqual(1);
    // Pid_events: one fetch_completed per recordFetchResult call (3 total).
    expect(eventCount ?? 0).toBeGreaterThanOrEqual(3);
    // Pid_fact_assertions: at minimum the bhulekh tenant fact.
    expect(factCount ?? 0).toBeGreaterThanOrEqual(1);
  }, 30_000);
});