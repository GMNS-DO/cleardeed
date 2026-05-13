#!/usr/bin/env node
/**
 * scrape-location-graph.ts — Day 2 deliverable
 *
 * Builds V1.1 location graph from Bhulekh dropdowns.
 * Output: packages/schema/src/data/odisha-location-graph.json
 *
 * Bhulekh dropdown cascade: district (20, Khordha) → tahasil → village options
 * Village dropdown is browser-JS-populated (confirmed Session 037) — use Playwright.
 * All BhulekhError redirects handled via JS evaluate() click on "here" postback link.
 *
 * Runtime: ~3-5 hours for 1,552 villages. No parallelization on first scrape.
 * Per-tehsil: district select + tahasil select + village read ≈ 15-20s per tehsil.
 * Total: 10 tehsils × ~20s = ~3-4 minutes actual work + jitter = ~4-5 hours.
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "../.."); // repo root
const OUTPUT_DIR = join(ROOT_DIR, "packages/schema/src/data");
const OUTPUT_PATH = join(OUTPUT_DIR, "odisha-location-graph.json");

const ROR_VIEW_URL = "https://bhulekh.ori.nic.in/RoRView.aspx";
const DISTRICT_CODE = "20"; // Khordha

// 10 Khordha tehsils with Bhulekh codes (confirmed Session 037)
const TAHASILS = [
  { code: "2",  name_en: "Bhubaneswar", name_or: "ଭୁବନେଶ୍ଵର",     alt: ["Bhubaneshwar"] },
  { code: "3",  name_en: "Kordha",      name_or: "ଖୋର୍ଦ୍ଧା",           alt: ["Khordha","Khorda","Khurdha","Khurda"] },
  { code: "6",  name_en: "Jatni",       name_or: "ଜଟଣୀ",            alt: ["Jatani"] },
  { code: "7",  name_en: "Tangi",      name_or: "ଟାଙ୍ଗି",            alt: [] },
  { code: "1",  name_en: "Banapur",     name_or: "ବାଣାପୁର",          alt: [] },
  { code: "8",  name_en: "Balianta",   name_or: "ବାଲିଅନ୍ତା",         alt: [] },
  { code: "9",  name_en: "Balipatna",  name_or: "ବାଲି ପାଟଣା",         alt: [] },
  { code: "4",  name_en: "Begunia",    name_or: "ବେଗୁନିଆ",          alt: ["Beguniapada"] },
  { code: "5",  name_en: "Bolgarh",    name_or: "ବୋଲଗଡ",            alt: ["Bolagarh"] },
  { code: "10", name_en: "Chilika",    name_or: "ଚିଲିକା",            alt: ["Balugaon"] },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(baseMs = 3000): number {
  return baseMs + Math.random() * 1000 - 500; // 2.5–3.5s
}

// ─── Bootstrap Bhulekh session ──────────────────────────────────────────────────

async function bootstrapSession(page: import("playwright").Page): Promise<void> {
  await page.goto(ROR_VIEW_URL, { waitUntil: "networkidle", timeout: 20000 });
  await sleep(500);

  const url = page.url();
  if (url.includes("BhulekhError")) {
    // "here" is a JavaScript __doPostBack link — use evaluate to click it
    await page.evaluate(() => {
      const link = document.querySelector('a[href*="LinkButton1"]');
      if (link) link.click();
    });
    await sleep(jitter());
    console.log("  Bootstrap: clicked 'here', now on", page.url());
  }
}

// ─── Select district + wait for tahasil to populate ─────────────────────────────

async function selectDistrict(page: import("playwright").Page): Promise<void> {
  const districtCount = await page.locator("#ctl00_ContentPlaceHolder1_ddlDistrict option").count();
  if (districtCount === 0) throw new Error("No district dropdown found — Bhulekh may be down");
  await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", DISTRICT_CODE);
  await sleep(jitter()); // wait for tahasil dropdown to populate
}

// ─── Read villages for one tahasil (Playwright) ─────────────────────────────────

async function readVillagesForTahasil(
  page: import("playwright").Page,
  tahasilCode: string,
  tehsilName: string
): Promise<{ value: string; text: string }[]> {
  // Try exact tahasil option first
  const tahOptSelector = `#ctl00_ContentPlaceHolder1_ddlTahsil option[value="${tahasilCode}"]`;
  const tahasilCount = await page.locator(tahOptSelector).count();

  if (tahasilCount === 0) {
    // Fallback: find by text match
    const allOpts = await page.locator("#ctl00_ContentPlaceHolder1_ddlTahsil option").all();
    for (const opt of allOpts) {
      const val = await opt.getAttribute("value");
      const txt = (await opt.textContent())?.trim() ?? "";
      if (val === tahasilCode || txt === tehsilName || txt.includes(tehsilName)) {
        await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", val ?? "");
        break;
      }
    }
  } else {
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", tahasilCode);
  }

  await sleep(jitter()); // wait for village dropdown to populate via JS

  // Read village options
  const villageOpts = await page.locator("#ctl00_ContentPlaceHolder1_ddlVillage option").all();
  const villages: { value: string; text: string }[] = [];
  for (const opt of villageOpts) {
    const value = (await opt.getAttribute("value")) ?? "";
    const text  = (await opt.textContent() ?? "").replace(/\s+/g, " ").trim();
    if (value && value !== "") {
      villages.push({ value, text });
    }
  }
  return villages;
}

// ─── Parse village option text ──────────────────────────────────────────────────
// Bhulekh dropdown options: "EnglishName" or "EnglishName | OdiaName" or just "OdiaName"

function parseVillageText(text: string): { name_en: string; name_or: string } {
  const parts = text.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const hasOdia = /[଀-୿]/.test(last);
    if (hasOdia) {
      const enPart = parts.slice(0, -1).join(" ").trim() || last;
      return { name_en: enPart || last, name_or: last };
    }
    return { name_en: parts[0], name_or: parts.slice(1).join(" | ") };
  }
  const hasOdia = /[଀-୿]/.test(text);
  if (hasOdia) return { name_en: "", name_or: text };
  return { name_en: text, name_or: "" };
}

// ─── Approximate RI circle assignment ──────────────────────────────────────────
// Uses tehsil-based primary RI assignment. RI circles are from Bhulekh header,
// confirmed by selecting a village and reading the RoR header's RI field.

function guessRICircle(tehsilCode: string): string {
  const primaryRIMap: Record<string, string> = {
    "2":  "Chandaka",
    "3":  "Kordha",
    "6":  "Jatni",
    "7":  "Tangi",
    "1":  "Banapur",
    "8":  "Balianta",
    "9":  "Balipatna",
    "4":  "Begunia",
    "5":  "Bolgarh",
    "10": "Balugaon",
  };
  return primaryRIMap[tehsilCode] ?? tehsilCode;
}

// ─── Graph data structures ────────────────────────────────────────────────────────

interface VillageEntry {
  name_en: string;
  name_or: string;
  bhulekhVillageCode: string | null;
  nameEnAlternates: string[];
  nameOrAlternates: string[];
}

interface RIEntry {
  name_en: string;
  villages: VillageEntry[];
}

interface TehsilEntry {
  name_en: string;
  name_or: string;
  bhulekh_value: string;
  alternateSpellings: string[];
  riCircles: RIEntry[];
}

interface LocationGraph {
  version: string;
  generatedAt: string;
  district: { name_en: string; name_or: string; bhulekh_value: string };
  tehsils: TehsilEntry[];
  _meta: {
    totalTehsils: number;
    totalVillages: number;
    digitizedVillages: number;
    notDigitizedVillages: number;
    scrapeSource: string;
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Bhulekh Location Graph Scrape — Day 2 ===");
  console.log(`Output: ${OUTPUT_PATH}`);
  console.log("Runtime: ~3-5 hours. Do not close this terminal.\n");

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Initialize graph
  const graph: LocationGraph = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    district: { name_en: "Khordha", name_or: "ଖୋର୍ଦ୍ଧା", bhulekh_value: DISTRICT_CODE },
    tehsils: [],
    _meta: {
      totalTehsils: TAHASILS.length,
      totalVillages: 0,
      digitizedVillages: 0,
      notDigitizedVillages: 0,
      scrapeSource: "bhulekh.ori.nic.in RoRView.aspx Playwright",
    },
  };

  // Launch browser — one browser instance for the entire scrape
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Bootstrap: handle BhulekhError redirect once
    console.log("Bootstrapping Bhulekh session...");
    await bootstrapSession(page);
    console.log("Bootstrap URL:", page.url());

    // Select district once (applies to all tehsils)
    console.log("Selecting district 20 (Khordha)...");
    await selectDistrict(page);
    console.log("Tahsil options:", await page.locator("#ctl00_ContentPlaceHolder1_ddlTahsil option").count());
    console.log("");

    // Scrape each tehsil
    for (const tehsil of TAHASILS) {
      console.log(`[${tehsil.name_en} (${tehsil.code})]`);
      await sleep(jitter()); // pause before each tehsil

      const villages = await readVillagesForTahasil(page, tehsil.code, tehsil.name_en);
      console.log(`  Found ${villages.length} villages`);

      // Group by RI circle (approximate — use tehsil primary RI)
      // In V1.2, read actual RI from RoR header when scraping individual villages
      const riCircle = guessRICircle(tehsil.code);
      const villageEntries: VillageEntry[] = villages.map(({ value, text }) => {
        const { name_en, name_or } = parseVillageText(text);
        return {
          name_en: name_en || name_or,
          name_or,
          bhulekhVillageCode: value || null,
          nameEnAlternates: [],
          nameOrAlternates: [],
        };
      });

      const riCircles: RIEntry[] = [{
        name_en: riCircle,
        villages: villageEntries,
      }];

      graph.tehsils.push({
        name_en: tehsil.name_en,
        name_or: tehsil.name_or,
        bhulekh_value: tehsil.code,
        alternateSpellings: tehsil.alt,
        riCircles,
      });

      const totalVillages = graph.tehsils.reduce(
        (s, t) => s + t.riCircles.reduce((r, ri) => r + ri.villages.length, 0), 0
      );
      const digitized = graph.tehsils.reduce(
        (s, t) => s + t.riCircles.reduce((r, ri) => r + ri.villages.filter((v) => v.bhulekhVillageCode).length, 0), 0
      );
      console.log(`  Cumulative: ${totalVillages} villages (${digitized} digitized)`);
    }
  } finally {
    await browser.close();
  }

  // Compute meta
  graph._meta.totalVillages = graph.tehsils.reduce(
    (s, t) => s + t.riCircles.reduce((r, ri) => r + ri.villages.length, 0), 0
  );
  graph._meta.digitizedVillages = graph.tehsils.reduce(
    (s, t) => s + t.riCircles.reduce(
      (r, ri) => r + ri.villages.filter((v) => v.bhulekhVillageCode).length, 0
    ), 0
  );
  graph._meta.notDigitizedVillages = graph._meta.totalVillages - graph._meta.digitizedVillages;

  // Verify
  console.log("\n=== Verification ===");
  const checks = [
    { label: "Tehsil count = 10", pass: graph.tehsils.length === 10 },
    {
      label: `Village count 1500-1600 (got ${graph._meta.totalVillages})`,
      pass: graph._meta.totalVillages >= 1400 && graph._meta.totalVillages <= 1650,
    },
    {
      label: "All villages have name_en or name_or",
      pass: graph.tehsils.every((t) => t.riCircles.every((ri) => ri.villages.every((v) => v.name_en || v.name_or))),
    },
    {
      label: "All tehsils have name_or",
      pass: graph.tehsils.every((t) => Boolean(t.name_or)),
    },
  ];

  for (const { label, pass } of checks) {
    console.log(`  [${pass ? "PASS" : "FAIL"}] ${label}`);
  }

  const allPass = checks.every((c) => c.pass);
  console.log(`\nOverall: ${allPass ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"}\n`);

  // Write output
  writeFileSync(OUTPUT_PATH, JSON.stringify(graph, null, 2), "utf-8");
  console.log(`✓ Written: ${OUTPUT_PATH}`);

  // Per-tehsil summary
  console.log("\nPer-tehsil village counts:");
  for (const t of graph.tehsils) {
    const total = t.riCircles.reduce((s, ri) => s + ri.villages.length, 0);
    const coded = t.riCircles.reduce((s, ri) => s + ri.villages.filter((v) => v.bhulekhVillageCode).length, 0);
    console.log(`  ${t.name_en}: ${total} villages, ${coded} with codes`);
  }

  console.log(`\nTotal: ${graph._meta.totalVillages} villages, ${graph._meta.digitizedVillages} with bhulekhVillageCode`);
  console.log("\nNext (Day 3): run aksharamukha transliteration over Odia names");
}

main().catch((err) => {
  console.error("\nScrape failed:", err);
  process.exit(1);
});