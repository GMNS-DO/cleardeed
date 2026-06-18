#!/usr/bin/env node
// scripts/generate-insights-table.mjs
//
// Regenerates the body of docs/insights/insights-engine.md from the registry.
//
// Usage (TS source is .ts, so we go through tsx):
//   npx tsx scripts/generate-insights-table.mjs > /tmp/rules-table.txt
//   # then paste into docs/insights/insights-engine.md between the table markers
//
// Or pipe straight into the doc with sed/awk — the columns are stable.

import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { ALL_RULES } from "../agents/consumer-report-writer/src/insights/registry/index.ts";

// 1. Build file map: ruleId -> source file path
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith(".ts") && !e.includes(".test.")) out.push(p);
  }
  return out;
}

const files = walk("./agents/consumer-report-writer/src/insights/registry");
const fileMap = {};
for (const r of ALL_RULES) {
  for (const f of files) {
    const c = readFileSync(f, "utf8");
    if (c.includes(`id: "${r.id}"`) || c.includes(`id: '${r.id}'`)) {
      fileMap[r.id] = relative(".", f);
      break;
    }
  }
}

// 2. Harness inputs — generous positive + sparse negative
const inputs = [
  // Positive: fully populated RoR, CERSAI clean, ECourts clean, EC clean, Bhunaksha clean
  {
    ror: {
      status: "verified",
      page1: {
        khatiyanNumber: "X", owner: "X", coOwners: ["a", "b"], landTypeOdia: "Sarad",
        father: "X", caste: "X", residence: "X", tenantName: "X", plotNo: "1", area: "1",
      },
      page2: {
        selectedPlotFound: true,
        plots: [{ plotNumber: "X", area: "1", landTypeOdia: "Sarad",
                  boundaryNorth: "N", boundarySouth: "S", boundaryEast: "E", boundaryWest: "W",
                  remarks: "X" }],
        areaA: "1", areaD: "0",
      },
      section6: {
        mutationCount: 17,
        mutations: [{ date: "2020-01-01", fromKhata: "a", toKhata: "b" }],
        encumbrances: [{ docNo: "1", date: "2020-01-01", amount: "100", type: "mortgage", partyName: "Bank" }],
        remarks: "X", plotCrops: "rice",
      },
      dues: { khajanaRent: "0", cess: "0", otherCess: "0", jalkar: "0", total: "0" },
    },
    cersai: { activeCharge: false, status: "verified" },
    ecourts: { status: "verified", cases: [{ caseNo: "C1", court: "High Court", type: "civil" }] },
    rccms: { status: "verified", cases: [{ caseNo: "C2" }] },
    ec: { status: "verified", deeds: [{ docNo: "D1", date: "2020-01-01", amount: "1000000", type: "sale" }] },
    bhunaksha: {
      status: "verified",
      plot: { plotNo: "1", kisam: "Sarad" },
      roadAccess: true,
      neighbours: [{ plotNo: "2", kisam: "X" }],
      polygon: { area: 1000 },
    },
    sourceStatuses: [{ source: "bhulekh", status: "verified" }, { source: "cersai", status: "verified" }],
    eowBlacklistAvailable: true,
    landUse: { zoning: "residential" },
    registry: { encumbrances: [], deeds: [] },
  },
  // Negative: sparse / edge-case RoR, CERSAI active, ECourts manual, RCCMS not_implemented, EC mortgage
  {
    ror: {
      status: "verified",
      page1: {},
      page2: { selectedPlotFound: false },
      section6: {},
      dues: { khajanaRent: "100", cess: "0", otherCess: "0", jalkar: "0", total: "100" },
    },
    cersai: { activeCharge: true, status: "verified" },
    ecourts: { status: "manual_required" },
    rccms: { status: "not_implemented" },
    ec: { status: "verified", deeds: [{ docNo: "D1", amount: "500000", date: "2020-01-01", type: "mortgage" }] },
    bhunaksha: { status: "verified", roadAccess: false, neighbours: [] },
    sourceStatuses: [
      { source: "rccms", status: "not_implemented" },
      { source: "bhulekh", status: "parser_uncertain" },
      { source: "bhulekh", status: "verified" },
    ],
    eowBlacklistAvailable: false,
  },
];

// 3. Run each rule, capture first non-null result
for (const r of ALL_RULES) {
  let result = null;
  for (const input of inputs) {
    const i = r.fn(input);
    if (i && i.length > 0) { result = i[0]; break; }
  }
  const stub = !result;
  const lens = result?.issueLens ?? "?";
  const evidence = result?.evidenceStrength ?? "?";
  const severity = result?.severity ?? "stub";
  const source = result?.source ?? "—";
  const file = fileMap[r.id] ?? "?";
  const status = stub ? "stub" : "live";
  console.log(`| ${r.id} | ${r.panel} | ${lens} | ${evidence} | ${severity} | ${source} | ${file} | ${status} |`);
}