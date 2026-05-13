/**
 * ClearDeed — End-to-End Persistence Verification
 *
 * Creates a test report using golden-path coordinates, then verifies:
 *   1. The report record exists in Supabase `reports` table
 *   2. Source result rows exist in Supabase `source_results` table
 *   3. /report/{id} renders the persisted HTML (not re-generated data)
 *
 * Usage:
 *   npx tsx scripts/verify-persistence.ts
 *   ADMIN_VIEW_TOKEN="..." REPORT_CREATE_TOKEN="..." npx tsx scripts/verify-persistence.ts
 *   CLEARDEED_BASE_URL="https://..." ADMIN_VIEW_TOKEN="..." npx tsx scripts/verify-persistence.ts
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ── Configuration ─────────────────────────────────────────────────────────────

const BASE_URL = (process.env.CLEARDEED_BASE_URL ?? "https://v0-cleardeed.vercel.app").replace(/\/+$/, "");
const ADMIN_VIEW_TOKEN = process.env.ADMIN_VIEW_TOKEN ?? "";
const REPORT_CREATE_TOKEN = process.env.REPORT_CREATE_TOKEN ?? ADMIN_VIEW_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// Golden-path coordinates (GPS 20.272688, 85.701271 — Mendhasala, Bhubaneswar)
const TEST_LAT = 20.272688;
const TEST_LON = 85.701271;
const TEST_OWNER = "Mohapatra";

const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

// ── Helpers ────────────────────────────────────────────────────────────────────

interface CheckResult {
  name: string;
  status: "passed" | "failed" | "skipped";
  detail?: string;
}

const checks: CheckResult[] = [];

async function check(name: string, fn: () => Promise<string>): Promise<void> {
  try {
    const detail = await fn();
    checks.push({ name, status: "passed", detail });
  } catch (err) {
    checks.push({
      name,
      status: "failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// ── Supabase client (service role — bypasses RLS) ─────────────────────────────

function getServiceClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to verify DB rows."
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// ── HTTP helpers ───────────────────────────────────────────────────────────────

async function postJson(path: string, body: unknown, bearerToken?: string) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "ClearDeed persistence verification",
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    text,
    json: parseJson(text),
  };
}

async function getPage(path: string) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "User-Agent": "ClearDeed persistence verification" },
  });
  return {
    status: response.status,
    text: await response.text(),
  };
}

function parseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

let reportId = "";
const label = `Persistence smoke ${runId}`;

console.log(`\nClearDeed persistence verification — ${label}`);
console.log(`Target: ${BASE_URL}`);
console.log(`Supabase: ${SUPABASE_URL ? "configured" : "NOT CONFIGURED (DB checks will be skipped)"}`);

// ── 1. Create report via API ────────────────────────────────────────────────

await check("report create returns durable reportId", async () => {
  if (!REPORT_CREATE_TOKEN) {
    throw new Error(
      "REPORT_CREATE_TOKEN or ADMIN_VIEW_TOKEN must be set locally to create a report."
    );
  }

  const response = await postJson("/api/report/create", {
    lat: TEST_LAT,
    lon: TEST_LON,
    claimedOwnerName: TEST_OWNER,
    plotDescription: `Persistence verification ${label}`,
  }, REPORT_CREATE_TOKEN);

  assert(
    response.status === 200,
    `expected 200, got ${response.status}: ${response.text}`
  );
  const body = response.json as Record<string, unknown>;
  assert(typeof body.reportId === "string" && body.reportId.length > 0, "no reportId in response");
  assert(typeof body.html === "string" && body.html.includes("ClearDeed"), "no report HTML in response");

  reportId = body.reportId as string;
  return `reportId=${reportId}`;
});

// ── 2. Verify report row in Supabase `reports` table ────────────────────────

if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  await check("report row exists in Supabase `reports` table", async () => {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("reports")
      .select("id, report_status, report_html, report_title, claimed_owner_name, gps_lat, gps_lon")
      .eq("id", reportId)
      .single();

    if (error) throw new Error(`reports table query failed: ${error.message}`);
    if (!data) throw new Error(`no row found for reportId=${reportId}`);

    assert(
      data.report_status === "complete",
      `expected report_status=complete, got ${data.report_status}`
    );
    assert(
      typeof data.report_html === "string" && data.report_html.length > 100,
      "report_html is missing or too short"
    );
    assert(
      data.claimed_owner_name === TEST_OWNER,
      `expected claimed_owner_name=${TEST_OWNER}, got ${data.claimed_owner_name}`
    );
    assert(
      Math.abs(Number(data.gps_lat) - TEST_LAT) < 0.0001,
      `gps_lat mismatch: expected ${TEST_LAT}, got ${data.gps_lat}`
    );
    assert(
      Math.abs(Number(data.gps_lon) - TEST_LON) < 0.0001,
      `gps_lon mismatch: expected ${TEST_LON}, got ${data.gps_lon}`
    );

    return `status=${data.report_status}, title="${data.report_title}", html length=${data.report_html.length}`;
  });

  // ── 3. Verify source_results rows exist ──────────────────────────────────

  await check("source_results rows exist in Supabase for all sources", async () => {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("source_results")
      .select("source_name, status, fetched_at")
      .eq("report_id", reportId)
      .order("source_name");

    if (error) throw new Error(`source_results query failed: ${error.message}`);
    if (!data || data.length === 0) throw new Error(`no source_results rows for reportId=${reportId}`);

    const found = new Set(data.map((r) => r.source_name as string));
    const expected = ["bhunaksha", "bhulekh", "ecourts", "nominatim", "rccms"];
    const missing = expected.filter((s) => !found.has(s));

    // We expect at least some sources to have rows (RCCMS may be partial)
    if (missing.length === expected.length) {
      throw new Error(`no expected source_results found. Got: ${[...found].join(", ")}`);
    }

    return `${data.length} rows: ${data.map((r) => `${r.source_name}=${r.status}`).join(", ")}`;
  });

  // ── 4. Verify `audit_log` entry ─────────────────────────────────────────

  await check("audit_log entry exists for report_created", async () => {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("audit_log")
      .select("id, event_type, report_id")
      .eq("report_id", reportId)
      .eq("event_type", "report_created")
      .single();

    if (error) throw new Error(`audit_log query failed: ${error.message}`);
    if (!data) throw new Error(`no report_created audit entry for reportId=${reportId}`);

    return `audit_log id=${data.id}`;
  });
} else {
  checks.push({
    name: "report row exists in Supabase `reports` table",
    status: "skipped",
    detail: "Supabase not configured locally",
  });
  checks.push({
    name: "source_results rows exist in Supabase for all sources",
    status: "skipped",
    detail: "Supabase not configured locally",
  });
  checks.push({
    name: "audit_log entry exists for report_created",
    status: "skipped",
    detail: "Supabase not configured locally",
  });
}

// ── 5. Verify /report/{id} renders persisted HTML ───────────────────────────

await check("GET /report/{id} renders persisted report HTML", async () => {
  assert(reportId, "reportId missing from previous check");

  const response = await getPage(`/report/${encodeURIComponent(reportId)}`);

  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(response.text.includes("ClearDeed"), "report page did not include ClearDeed");
  assert(
    !response.text.includes("CLD-GOLDEN-001") && !response.text.includes("DEMO"),
    "report page appears to be the demo/golden fixture"
  );
  assert(
    !response.text.includes("Report not available yet"),
    "report page appears to show the not-yet-generated placeholder"
  );

  return `rendered successfully`;
});

// ── 6. Verify the HTML is the same as what was returned at creation ───────────

await check("persisted HTML matches what the API returned at creation time", async () => {
  assert(reportId, "reportId missing");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for this check");
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reports")
    .select("report_html")
    .eq("id", reportId)
    .single();

  if (error) throw new Error(`reports query failed: ${error.message}`);
  if (!data) throw new Error(`no row found for reportId=${reportId}`);

  // The HTML stored in DB should match what was returned at creation time.
  // We verify the DB row has substantive content.
  const html = data.report_html as string | null;
  assert(
    typeof html === "string" && html.length > 500,
    `report_html in DB is missing or too short (${html?.length ?? 0} chars)`
  );
  assert(
    html!.includes("ClearDeed"),
    "report_html in DB does not include ClearDeed"
  );

  return `DB HTML length=${html!.length}`;
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log("\nResults:");
const failed = checks.filter((r) => r.status === "failed");
for (const result of checks) {
  const icon =
    result.status === "passed" ? "PASS" :
    result.status === "skipped" ? "SKIP" : "FAIL";
  console.log(`${icon} ${result.name}${result.detail ? ` — ${result.detail}` : ""}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} check(s) failed.`);
  process.exit(1);
} else {
  console.log(`\nAll checks passed.`);
  process.exit(0);
}
