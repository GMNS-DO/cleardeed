#!/usr/bin/env node

const DEFAULT_BASE_URL = "https://v0-cleardeed.vercel.app";
const baseUrl = normalizeBaseUrl(process.env.CLEARDEED_BASE_URL ?? DEFAULT_BASE_URL);
const adminToken = process.env.ADMIN_VIEW_TOKEN;
const reportCreateToken = process.env.REPORT_CREATE_TOKEN ?? adminToken;

const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

const checks = [];

await check("home page renders Sprint 1 checkout surface", async () => {
  const response = await getText("/");
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(response.text.includes("Pay ₹1") || response.text.includes("Pay &#x20B9;1"), "home page did not include ₹1 checkout copy");
  assert(response.text.includes("Khordha"), "home page did not include Khordha launch scope");
  return "loaded";
});

await check("DPDP pages render", async () => {
  const [privacy, terms] = await Promise.all([getText("/privacy"), getText("/terms")]);
  assert(privacy.status === 200, `privacy expected 200, got ${privacy.status}`);
  assert(terms.status === 200, `terms expected 200, got ${terms.status}`);
  assert(privacy.text.includes("Privacy"), "privacy page missing privacy copy");
  assert(terms.text.includes("Terms"), "terms page missing terms copy");
  return "privacy + terms";
});

await check("Razorpay order creates ₹1 checkout", async () => {
  const response = await postJson("/api/order", {
    email: `smoke+${runId}@cleardeed.in`,
    plotDescription: "Production smoke-test order",
  });

  assert(response.status === 200, `expected 200, got ${response.status}: ${response.text}`);
  assert(typeof response.json?.orderId === "string", "order response did not include orderId");
  assert(response.json?.amount === 100, `expected ₹1/100 paise amount, got ${response.json?.amount}`);
  assert(response.json?.currency === "INR", "order currency was not INR");
  return `orderId=${response.json.orderId}`;
});

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
let reportUrl = "";
await check("report create persists durable id", async () => {
  const response = await postJson("/api/report/create", {
    lat: 20.272688,
    lon: 85.701271,
    claimedOwnerName: "Mohapatra",
    plotDescription: `Production smoke-test report ${runId}`,
  }, reportCreateToken);

  assert(response.status === 200, `expected 200, got ${response.status}: ${response.text}`);
  assert(typeof response.json?.reportId === "string", "report response did not include reportId");
  assert(typeof response.json?.reportUrl === "string", "report response did not include token-scoped reportUrl");
  assert(response.json.reportUrl.includes("?token="), "reportUrl did not include an access token");
  assert(typeof response.json?.html === "string" && response.json.html.includes("ClearDeed"), "report HTML missing");
  reportId = response.json.reportId;
  reportUrl = response.json.reportUrl;
  return `reportId=${reportId}`;
});

await check("report link renders with token", async () => {
  assert(reportId, "reportId missing from previous check");
  assert(reportUrl, "reportUrl missing from previous check");
  const reportPath = pathFromAbsoluteUrl(reportUrl);
  const response = await getText(reportPath);
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(response.text.includes("ClearDeed"), "report page did not include ClearDeed");
  assert(!response.text.includes("CLD-GOLDEN-001"), "report page appears to be the demo/golden fixture");
  assert(!response.text.includes("Report not available yet"), "report page did not load persisted HTML");
  return reportPath;
});

await check("report link fails closed without token", async () => {
  assert(reportId, "reportId missing from previous check");
  const response = await getText(`/report/${encodeURIComponent(reportId)}`);
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(response.text.includes("invalid access token"), "report page without token did not fail closed");
  return "locked";
});

await check("PDF download renders from persisted report HTML", async () => {
  assert(reportId, "reportId missing from previous check");
  assert(reportUrl, "reportUrl missing from previous check");
  const token = new URL(reportUrl).searchParams.get("token");
  const response = await getBinary(`/api/report/${encodeURIComponent(reportId)}/pdf?token=${encodeURIComponent(token)}`);
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(response.contentType.includes("application/pdf"), `expected PDF content-type, got ${response.contentType}`);
  assert(response.textStart === "%PDF-", "PDF response did not start with %PDF-");
  return "pdf";
});

await check("in-report feedback endpoint captures section vote", async () => {
  assert(reportId, "reportId missing from previous check");
  const response = await postJson("/api/feedback", {
    reportId,
    section: "plot",
    vote: "up",
    comment: `Smoke feedback ${runId}`,
  });

  assert(response.status === 200, `expected 200, got ${response.status}: ${response.text}`);
  assert(response.json?.ok === true, "feedback response did not include ok=true");
  return "stored";
});

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

async function getBinary(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "User-Agent": "ClearDeed production smoke test" },
  });
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    textStart: buffer.toString("utf8", 0, 5),
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

function pathFromAbsoluteUrl(value) {
  const parsed = new URL(value);
  return `${parsed.pathname}${parsed.search}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
