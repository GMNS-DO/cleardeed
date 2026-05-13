#!/usr/bin/env node --input-type=module
/**
 * scripts/golden-path.ts
 *
 * Diagnostic: runs all 4 fetchers serially against real servers for
 * test coordinates (20.272688, 85.701271) + name "Mohapatra".
 * Saves output to fixtures/golden-path-result.json.
 *
 * Run: npx tsx scripts/golden-path.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { nominatimFetch } from "../packages/fetchers/nominatim/src/index.ts";
import { bhunakshaFetch } from "../packages/fetchers/bhunaksha/src/index.ts";
import { fetch as bhulekhFetch } from "../packages/fetchers/bhulekh/src/index.ts";
import { ecourtsFetch } from "../packages/fetchers/ecourts/src/index.ts";

const COORDS = { lat: 20.272688, lon: 85.701271 };
const TEST_NAME = "Mohapatra";

const FIXTURES_DIR = join(
  fileURLToPath(import.meta.url),
  "..",
  "..",
  "packages",
  "fetchers",
  "nominatim",
  "fixtures"
);
mkdirSync(FIXTURES_DIR, { recursive: true });

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function delay(ms = 5000) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeResult(name: string, fn: () => Promise<unknown>) {
  return fn().catch((e) => ({
    source: name,
    status: "failed",
    error: e instanceof Error ? e.message : String(e),
    stack: e instanceof Error ? e.stack : undefined,
  }));
}

// ─── Step 1: Nominatim ────────────────────────────────────────────────────────

async function step1() {
  console.log("\n=== NOMINATIM ===");
  const result = await safeResult("nominatim", async () => {
    return await nominatimFetch({
      gps: { lat: COORDS.lat, lon: COORDS.lon },
    });
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

// ─── Step 2: Bhunaksha ────────────────────────────────────────────────────────

async function step2() {
  console.log("\n=== BHUNAKSHA (GeoServer WFS) ===");
  const result = await safeResult("bhunaksha", async () => {
    return await bhunakshaFetch({
      lat: COORDS.lat,
      lon: COORDS.lon,
    });
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

// ─── Step 3: Bhulekh ──────────────────────────────────────────────────────────

async function step3(village: string, plotNo?: string) {
  console.log("\n=== BHULEKH ===");
  const result = await safeResult("bhulekh", async () => {
    return await bhulekhFetch({
      gps: COORDS,
      village: village || "Mendhasala",
      ownerName: TEST_NAME,
      plotNo,
    });
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

// ─── Step 4: eCourts ───────────────────────────────────────────────────────────

async function step4() {
  console.log("\n=== ECOURTS ===");
  const result = await safeResult("ecourts", async () => {
    return await ecourtsFetch({
      partyName: TEST_NAME,
    });
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

// ─── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `Starting golden path diagnostic...\n  Coordinates: ${COORDS.lat}, ${COORDS.lon}\n  Name: ${TEST_NAME}`
  );

  // Step 1: Nominatim
  const nomResult = await step1();
  const village =
    (nomResult as Record<string, unknown>).data &&
    ((nomResult as Record<string, { data: { village?: string } }>).data as { village?: string })
      ?.village;

  await delay();

  // Step 2: Bhunaksha
  const bhuResult = await step2();
  const plotNo =
    (bhuResult as Record<string, unknown>).data &&
    ((bhuResult as Record<string, { data: { plotNo?: string } }>).data as { plotNo?: string })
      ?.plotNo;
  await delay();

  // Step 3: Bhulekh (most likely to fail — untested)
  const blkhResult = await step3(village as string, plotNo);
  await delay();

  // Step 4: eCourts
  const ecourtsResult = await step4();

  // ─── Summary ───────────────────────────────────────────────────────────────

  console.log("\n=== GOLDEN PATH SUMMARY ===");

  const summary = {
    timestamp: new Date().toISOString(),
    coordinates: COORDS,
    name_searched: TEST_NAME,
    results: {
      nominatim: {
        status: (nomResult as Record<string, string>).status,
        district: ((nomResult as Record<string, { data: { district?: string } }>).data as { district?: string })
          ?.district,
        village: ((nomResult as Record<string, { data: { village?: string } }>).data as { village?: string })
          ?.village,
      },
      bhunaksha: {
        status: (bhuResult as Record<string, string>).status,
        plot_number:
          ((bhuResult as Record<string, { data: { plotNo?: string } }>).data as { plotNo?: string })
            ?.plotNo,
        village: ((bhuResult as Record<string, { data: { village?: string } }>).data as { village?: string })
          ?.village,
        area: ((bhuResult as Record<string, { data: { area?: number } }>).data as { area?: number })
          ?.area,
      },
      bhulekh: {
        status: (blkhResult as Record<string, string>).status,
        owners: (
          (blkhResult as Record<string, { data?: { tenants?: Array<{ tenantName: string }> } }>)
            .data as { tenants?: Array<{ tenantName: string }> } | undefined
        )?.tenants?.map((t) => t.tenantName) ?? [],
        error: (blkhResult as Record<string, string>).error ?? null,
      },
      ecourts: {
        status: (ecourtsResult as Record<string, string>).status,
        cases_found: (
          (ecourtsResult as Record<string, { data?: { total?: number } }>).data as
            | { total?: number }
            | undefined
        )?.total ?? 0,
        captcha_solved: true, // TODO: track actual captcha solve result
        error: (ecourtsResult as Record<string, string>).error ?? null,
      },
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  const outPath = join(FIXTURES_DIR, "golden-path-result.json");
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`\nResults saved to: ${outPath}`);
}

main().catch((e) => {
  console.error("Golden path crashed:", e);
  process.exit(1);
});
