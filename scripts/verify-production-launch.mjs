#!/usr/bin/env node

const DEFAULT_BASE_URL = "https://v0-cleardeed.vercel.app";
const baseUrl = normalizeBaseUrl(process.env.CLEARDEED_BASE_URL ?? DEFAULT_BASE_URL);
const adminToken = process.env.ADMIN_VIEW_TOKEN;
const reportCreateToken = process.env.REPORT_CREATE_TOKEN ?? adminToken;

const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

const checks = [];

await check("lead intake writes", async () => {
  const response = await postJson("/api/leads", {
    buyerName: `ClearDeed Smoke ${runId}`,
    phone: `+919999${runId.slice(-6)}`,
    userType: "buyer",
    locationText: "Mendhasala, Bhubaneswar, Khordha",
    gpsLat: 20.272688,
    gpsLon: 85.701271,
    claimedOwnerName: "Mohapatra",
    plotDescription: "Production smoke-test lead. Ignore unless investigating launch plumbing.",
    notes: `Smoke test ${runId}`,
  });

  assert(response.status === 201, `expected 201, got ${response.status}: ${response.text}`);
  assert(response.json?.ok === true, "lead response did not include ok=true");
  assert(typeof response.json?.leadId === "string", "lead response did not include leadId");
  return `leadId=${response.json.leadId}`;
});

let reportId = "";
await check("report create persists durable id", async () => {
  assert(
    reportCreateToken,
    "REPORT_CREATE_TOKEN or ADMIN_VIEW_TOKEN must be set locally to verify concierge report creation"
  );
  const response = await postJson("/api/report/create", {
    lat: 20.272688,
    lon: 85.701271,
    claimedOwnerName: "Mohapatra",
    plotDescription: `Production smoke-test report ${runId}`,
  }, reportCreateToken);

  assert(response.status === 200, `expected 200, got ${response.status}: ${response.text}`);
  assert(typeof response.json?.reportId === "string", "report response did not include reportId");
  assert(typeof response.json?.html === "string" && response.json.html.includes("ClearDeed"), "report HTML missing");
  reportId = response.json.reportId;
  return `reportId=${reportId}`;
});

await check("report link renders persisted report", async () => {
  assert(reportId, "reportId missing from previous check");
  const response = await getText(`/report/${encodeURIComponent(reportId)}`);
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(response.text.includes("ClearDeed"), "report page did not include ClearDeed");
  assert(!response.text.includes("CLD-GOLDEN-001"), "report page appears to be the demo/golden fixture");
  assert(!response.text.includes("Report not available yet"), "report page did not load persisted HTML");
  return `/report/${reportId}`;
});

await check("admin view fails closed without token", async () => {
  const response = await getText("/admin");
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(response.text.includes("Access token required"), "admin page did not fail closed");
  return "locked";
});

if (adminToken) {
  await check("admin view loads with token", async () => {
    const response = await getText(`/admin?token=${encodeURIComponent(adminToken)}`);
    assert(response.status === 200, `expected 200, got ${response.status}`);
    assert(response.text.includes("ClearDeed admin"), "admin page did not render");
    assert(response.text.includes(reportId.slice(0, 8)), "admin page did not show smoke report");
    return "loaded";
  });
} else {
  checks.push({ name: "admin view loads with token", status: "skipped", detail: "ADMIN_VIEW_TOKEN not set" });
}

const failed = checks.filter((result) => result.status === "failed");
console.log("\nProduction smoke summary");
for (const result of checks) {
  const icon = result.status === "passed" ? "PASS" : result.status === "skipped" ? "SKIP" : "FAIL";
  console.log(`${icon} ${result.name}${result.detail ? ` — ${result.detail}` : ""}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}

async function check(name, fn) {
  try {
    const detail = await fn();
    checks.push({ name, status: "passed", detail });
  } catch (error) {
    checks.push({ name, status: "failed", detail: error instanceof Error ? error.message : String(error) });
  }
}

async function postJson(path, body, bearerToken) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(bearerToken ? { "Authorization": `Bearer ${bearerToken}` } : {}),
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

async function getText(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "User-Agent": "ClearDeed production smoke test" },
  });
  return {
    status: response.status,
    text: await response.text(),
  };
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
