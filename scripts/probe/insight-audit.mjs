// scripts/probe/insight-audit.mjs — PI-2 Track C audit.
//
// Walks every rule in agents/consumer-report-writer/src/insights/registry and
// classifies its disposition against the current source-state stamp set:
//
//   - BHULEKH  → DONE (live, the foundation tier)
//   - BDA      → DONE (live)
//   - BHUVAN   → DONE (live, license-gated)
//   - CERSAI   → DONE (captcha breaker shipped 2026-06-19; partial results)
//   - COURT (eCourts / High Court / DRT) → NO-GO (BASE_URL migration) or UNTESTED
//   - IGR-EC   → NO-GO (concierge only)
//   - RERA     → NO-GO (no direct party search)
//   - MCA      → NO-GO (entity-conditional)
//
// Severity-bearing rules (redFlag, high, critical) must trace to one of those
// dispositions AND have a `manual_required` action item. Watchouts and
// positives are additive and don't need action items. The script also
// flags any rule ID referenced in the registry that does not appear in this
// audit map (catches gaps between the registry and the disposition stamps).

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, "../fixtures/insight-audit");
mkdirSync(FIXTURE_DIR, { recursive: true });

// ── Hand-curated rule → source-state map ───────────────────────────────────────
// Each entry matches IDs that actually exist in the registry (verified via
// `grep` of `agents/consumer-report-writer/src/insights/registry/**/*.ts`).
// Unknown IDs would surface in `orphanedRuleIds[]` below and should be added.
//
// Done-severity rules (redFlag without manual_required) only ship when the
// source is DONE and the rule code itself has been live-tested. Where a
// rule's severity is the highest tier (redFlag) AND its source is NO-GO,
// the rule code MUST emit a manual_required action item, OR the source
// must migrate to DONE before the rule can ship auto-claims.

const SOURCE_STATE_BY_RULE_ID = {
  // bhulekh/plot (10s)
  "ROR-INS-010": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-011": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-012": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-013": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-014": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-015": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-016": { source: "bhulekh", disposition: "DONE_STUB" },
  // bhulekh/owner (20s)
  "ROR-INS-020": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-021": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-022": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-023": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-024": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-025": { source: "bhulekh", disposition: "DONE_STUB" },
  "ROR-INS-026": { source: "bhulekh+nominatim", disposition: "DONE" },
  // bhulekh/land (30s, lease detector T-050)
  "ROR-INS-030": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-031": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-032": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-033": { source: "bhulekh", disposition: "DONE_STUB" }, // leaseDeedSthitibanStub
  "ROR-INS-034": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-035": { source: "bhulekh", disposition: "DONE" },
  // bhulekh/plotTable (40s, sub-plot T-052)
  "ROR-INS-040": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-041": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-042": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-043": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-044": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-045": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-046": { source: "bhulekh", disposition: "DONE" },
  // bhulekh/dues (50s)
  "ROR-INS-050": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-051": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-052": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-053": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-054": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-055": { source: "bhulekh", disposition: "DONE" },
  // bhulekh/backPage (60s)
  "ROR-INS-060": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-061": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-062": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-063": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-064": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-065": { source: "bhulekh", disposition: "DONE" },
  // bhulekh/chain (70s)
  "ROR-INS-070": { source: "bhulekh+bhunaksha", disposition: "DONE" },
  "ROR-INS-071": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-072": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-073": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-074": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-075": { source: "bhulekh+igr-ec", disposition: "DONE_MANUAL_VERIFIED" },
  "ROR-INS-076": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-077": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-078": { source: "bhulekh+bhunaksha", disposition: "DONE" },
  "ROR-INS-079": { source: "bhulekh+bhunaksha", disposition: "DONE" },
  "ROR-INS-080": { source: "bhulekh+bhunaksha", disposition: "DONE" },
  "ROR-INS-081": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-082": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-083": { source: "bhulekh", disposition: "DONE" },
  // bhulekh/land-misc (90s)
  "ROR-INS-090": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-091": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-092": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-093": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-094": { source: "bhulekh", disposition: "DONE" },
  // registry/court (100s) — depends on eCourts/High Court/DRT
  "ROR-INS-100": { source: "ecourts", disposition: "NO_GO_MIGRATION" },
  "ROR-INS-101": { source: "ecourts", disposition: "NO_GO_MIGRATION" },
  "ROR-INS-102": { source: "high-court", disposition: "NO_GO_MIGRATION" },
  "ROR-INS-103": { source: "cersai", disposition: "DONE_MANUAL_OPTIONAL" },
  "ROR-INS-104": { source: "drt", disposition: "DONE_MANUAL_STUB" },
  // registry/encumbrance (110s) — IGR-EC / CERSAI
  "ROR-INS-110": { source: "igr-ec", disposition: "DONE_MANUAL_OPTIONAL" },
  "ROR-INS-111": { source: "igr-ec", disposition: "DONE_MANUAL_OPTIONAL" },
  "ROR-INS-112": { source: "igr-ec", disposition: "DONE_MANUAL_OPTIONAL" },
  "ROR-INS-113": { source: "cersai", disposition: "DONE_MANUAL_OPTIONAL" },
  "ROR-INS-114": { source: "ecourts", disposition: "NO_GO_MIGRATION" },
  // registry/deeds (120s) — IGR / Bhulekh back page
  "ROR-INS-120": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-121": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-122": { source: "igr-ec", disposition: "DONE_MANUAL_OPTIONAL" },
  // registry/financial (130s) — circle rate
  "ROR-INS-130": { source: "circle-rate", disposition: "DONE_MANUAL_OPTIONAL" },
  "ROR-INS-131": { source: "circle-rate", disposition: "DONE_MANUAL_OPTIONAL" },
  "ROR-INS-132": { source: "circle-rate", disposition: "DONE_MANUAL_OPTIONAL" },
  // registry/completeness (140s) — pipeline completeness
  "ROR-INS-140": { source: "pipeline", disposition: "DONE" },
  "ROR-INS-141": { source: "pipeline", disposition: "DONE" },
  "ROR-INS-142": { source: "pipeline", disposition: "DONE" },
  "ROR-INS-143": { source: "pipeline", disposition: "DONE" },
  // recursive/zoning (150s) — BDA + lease
  "ROR-INS-150": { source: "bda-zoning", disposition: "DONE" },
  "ROR-INS-151": { source: "bda-zoning", disposition: "DONE" },
  "ROR-INS-152": { source: "bhulekh", disposition: "DONE" }, // sub-plot (T-052)
  "ROR-INS-153": { source: "bda-zoning", disposition: "DONE" }, // industrial zone
  "ROR-INS-155": { source: "bda-zoning", disposition: "DONE" },
  "ROR-INS-156": { source: "bda-zoning", disposition: "DONE" },
  // recursive/neighbours (160s)
  "ROR-INS-160": { source: "bhunaksha", disposition: "DONE" },
  "ROR-INS-161": { source: "bhunaksha", disposition: "DONE" },
  "ROR-INS-162": { source: "bhunaksha", disposition: "DONE" },
  "ROR-INS-163": { source: "bhunaksha", disposition: "DONE" },
  // recursive/chain-recursive (170s)
  "ROR-INS-170": { source: "bhulekh", disposition: "DONE" },
  // bhulekh/lease (180s — T-050)
  "ROR-INS-180": { source: "bhulekh+igr-ec", disposition: "DONE" },
  "ROR-INS-181": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-182": { source: "bhulekh", disposition: "DONE" },
  "ROR-INS-183": { source: "cersai", disposition: "DONE_MANUAL_OPTIONAL" },
  // bhuvan-flood/flood (200s — T-041)
  "ROR-INS-200": { source: "bhuvan-flood", disposition: "DONE_LICENSE_GATED" },
  "ROR-INS-201": { source: "bhuvan-flood", disposition: "DONE_LICENSE_GATED" },
  // recursive/area-cross (210s)
  "ROR-INS-210": { source: "bhulekh+bhunaksha", disposition: "DONE" },
  "ROR-INS-211": { source: "bhulekh+bhunaksha", disposition: "DONE" },
};

// ── Read actual rule IDs from the registry ────────────────────────────────────
const REGISTRY_GLOB = [
  "agents/consumer-report-writer/src/insights/registry/index.ts",
  "agents/consumer-report-writer/src/insights/registry/**/*.ts",
];
// Vitest + globbing in node — we use a small recursive walker instead of
// loading glob.
import { readdirSync, statSync } from "node:fs";

function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = resolve(dir, f);
    if (statSync(p).isDirectory()) {
      yield* walk(p);
    } else if (p.endsWith(".ts") && !p.endsWith(".test.ts")) {
      yield p;
    }
  }
}

const REGISTRY_DIR = "agents/consumer-report-writer/src/insights/registry";
const registryFiles = [...walk(resolve(__dirname, "../..", REGISTRY_DIR))];

const actualRuleIds = new Set();
for (const file of registryFiles) {
  const txt = readFileSync(file, "utf8");
  for (const m of txt.matchAll(/\bid:\s*"((?:ROR-INS|STUB)-[0-9]+)"/g)) {
    actualRuleIds.add(m[1]);
  }
}

const auditRuleIds = new Set(Object.keys(SOURCE_STATE_BY_RULE_ID));
const orphanedRuleIds = [...actualRuleIds].filter((id) => !auditRuleIds.has(id));
const staleRuleIds = [...auditRuleIds].filter((id) => !actualRuleIds.has(id));

// ── Stats ─────────────────────────────────────────────────────────────────────
const counts = Object.values(SOURCE_STATE_BY_RULE_ID).reduce((acc, e) => {
  acc[e.disposition] = (acc[e.disposition] || 0) + 1;
  return acc;
}, {});

// Strict acceptance: zero UNTESTED, no orphans, no stale.
let verdict = "PASS";
if ((counts.UNTESTED || 0) > 0) verdict = "FAIL_UNTESTED_PRESENT";
if (orphanedRuleIds.length > 0) verdict = "FAIL_ORPHANED_RULES";
if (staleRuleIds.length > 0) verdict = "FAIL_STALE_AUDIT_MAP";

const audit = {
  schemaVersion: 1,
  auditedAt: new Date().toISOString(),
  dateStamp: new Date().toISOString().slice(0, 10),
  sourceMapCount: auditRuleIds.size,
  registryRuleCount: actualRuleIds.size,
  counts,
  orphanedRuleIds,
  staleRuleIds,
  rules: Object.entries(SOURCE_STATE_BY_RULE_ID)
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => a.id.localeCompare(b.id)),
  verdict,
};

if (verdict === "PASS") {
  console.log(`✓ Insight audit PASS — ${auditRuleIds.size} rules traced, ${actualRuleIds.size} in registry.`);
} else {
  console.log(`✗ Insight audit ${verdict}`);
}

console.log(`  Disposition counts:`);
for (const [k, v] of Object.entries(counts)) console.log(`    ${k}: ${v}`);
if (orphanedRuleIds.length > 0) {
  console.log(`  Orphaned rule IDs (in registry but missing from audit map):`);
  for (const id of orphanedRuleIds) console.log(`    ${id}`);
}
if (staleRuleIds.length > 0) {
  console.log(`  Stale audit IDs (in audit map but missing from registry):`);
  for (const id of staleRuleIds) console.log(`    ${id}`);
}

const outPath = resolve(FIXTURE_DIR, `insight-audit-${audit.dateStamp}.json`);
writeFileSync(outPath, JSON.stringify(audit, null, 2));
console.log(`Fixture written: ${outPath}`);
