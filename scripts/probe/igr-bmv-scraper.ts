#!/usr/bin/env node
/**
 * IGR Odisha BMV (Benchmark Valuation) Scraper
 *
 * Usage:
 *   node scripts/probe/igr-bmv-scraper.ts --probe   # Inspect form structure first
 *   node scripts/probe/igr-bmv-scraper.ts --scrape  # Run full scrape
 *
 * This script queries the IGR Odisha ViewFeeValue.aspx portal for circle rate
 * (benchmark valuation) data per mouza/village in Khordha district, then writes
 * a JSON file consumed by packages/fetchers/circle-rate.
 *
 * Output: packages/fetchers/circle-rate/data/khordha_circle_rates.json
 *
 * IMPORTANT: Run --probe first to verify the form structure. The IGR portal
 * changes its ASP.NET field IDs periodically; the selectors in this script
 * are matched by partial name (`id*='ddlDistrict'`) but may need updates.
 *
 * MANUAL FALLBACK: If the scrape fails or returns 0 rows, the user can manually
 * query 5-10 villages via the IGR web form, paste the results into the JSON
 * file directly. The fetcher is designed to gracefully handle partial data.
 */

import { chromium, type Browser, type Page } from "playwright";
import { writeFileSync, mkdirSync, existsSync, appendFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const IGR_URL = "https://igrodisha.gov.in/ViewFeeValue.aspx";
const OUTPUT_FILE = join(__dirname, "../packages/fetchers/circle-rate/data/khordha_circle_rates.json");
const LOG_FILE = join(__dirname, "../packages/fetchers/circle-rate/data/scrape_log.md");

// Top villages from KHRDHA_VILLAGES (by transaction likelihood)
const TARGET_VILLAGES = [
  // Bhubaneswar tehsil (highest demand)
  { village: "Mendhasala", tahasil: "Bhubaneswar", sro: "Bhubaneswar" },
  { village: "Chandaka", tahasil: "Bhubaneswar", sro: "Bhubaneswar" },
  { village: "Nuagaon", tahasil: "Bhubaneswar", sro: "Bhubaneswar" },
  { village: "Sijua", tahasil: "Bhubaneswar", sro: "Bhubaneswar" },
  { village: "Gothapada", tahasil: "Bhubaneswar", sro: "Bhubaneswar" },
  { village: "Pahali", tahasil: "Bhubaneswar", sro: "Bhubaneswar" },
  { village: "Khurda", tahasil: "Bhubaneswar", sro: "Bhubaneswar" },
  { village: "Garage", tahasil: "Bhubaneswar", sro: "Bhubaneswar" },
  // Jatni tehsil
  { village: "Jatni", tahasil: "Jatni", sro: "Jatni" },
  { village: "Pokhariput", tahasil: "Jatni", sro: "Jatni" },
  { village: "Malipur", tahasil: "Jatni", sro: "Jatni" },
  { village: "Bomikhal", tahasil: "Jatni", sro: "Jatni" },
  { village: "Pithapur", tahasil: "Jatni", sro: "Jatni" },
  // Balipatna tehsil
  { village: "Balipatna", tahasil: "Balipatna", sro: "Balipatna" },
  { village: "Benudal", tahasil: "Balipatna", sro: "Balipatna" },
  { village: "Garekan", tahasil: "Balipatna", sro: "Balipatna" },
  // Balianta tehsil
  { village: "Balianta", tahasil: "Balianta", sro: "Balianta" },
  { village: "Krupa", tahasil: "Balianta", sro: "Balianta" },
  { village: "Naranpura", tahasil: "Balianta", sro: "Balianta" },
  // Khordha tehsil
  { village: "Begunia", tahasil: "Khordha", sro: "Khordha" },
  { village: "Bolagarh", tahasil: "Khordha", sro: "Khordha" },
  { village: "Khandagiri", tahasil: "Khandagiri", sro: "Bhubaneswar" },
];

const KISAMS = ["Bari", "Abadi", "Bagayat"];

interface CircleRateRow {
  village: string;
  tahasil: string;
  sro: string;
  kisam: string;
  ratePerAcre: number;
  ratePerSqft: number;
  ratePerDecimal: number;
  sourceUrl: string;
  sourceDate: string;
}

const log = (msg: string) => {
  console.log(msg);
  appendFileSync(LOG_FILE, `${new Date().toISOString()} ${msg}\n`);
};

async function probeForm(page: Page) {
  log("\n=== PROBE MODE — Inspecting IGR form structure ===\n");
  await page.goto(IGR_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

  // Find all form fields with their IDs
  const fields = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input, select, button, a.btn"));
    return inputs
      .filter((el) => el.id || el.name)
      .map((el) => ({
        tag: el.tagName,
        type: (el as HTMLInputElement).type || "",
        id: el.id,
        name: (el as HTMLInputElement).name || "",
        label: (el.previousElementSibling?.textContent || el.parentElement?.textContent || "").trim().slice(0, 60),
        options: el.tagName === "SELECT"
          ? Array.from((el as HTMLSelectElement).options).map((o) => o.textContent?.trim() || "")
          : undefined,
      }));
  });

  log(`Discovered ${fields.length} form elements:\n`);
  for (const f of fields) {
    log(`  <${f.tag}${f.type ? ` type="${f.type}"` : ""}> id="${f.id}" name="${f.name}" label="${f.label}"`);
    if (f.options && f.options.length > 0 && f.options.length < 50) {
      log(`     options: ${f.options.slice(0, 15).join(" | ")}${f.options.length > 15 ? " ..." : ""}`);
    }
  }

  log("\n=== Probe complete. Check the form structure above and update selectors if needed. ===\n");
}

async function selectDistrict(page: Page, district: string): Promise<boolean> {
  // Try multiple selector strategies
  const selectors = [
    "select[id*='ddlDistrict']",
    "select[id*='District']",
    "select[name*='ddlDistrict']",
    "#ctl00_ContentPlaceHolder1_ddlDistrict",
  ];
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.count() > 0) {
      try {
        await el.selectOption({ label: district });
        log(`  ✓ District selected via ${sel}`);
        return true;
      } catch (e) {
        log(`  ✗ Failed with ${sel}: ${(e as Error).message}`);
      }
    }
  }
  return false;
}

async function selectSRO(page: Page, sro: string): Promise<boolean> {
  await page.waitForTimeout; // ASP.NET postback delay
  const selectors = [
    "select[id*='ddlSRO']",
    "select[id*='SRO']",
    "select[name*='ddlSRO']",
  ];
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.count() > 0) {
      try {
        await el.selectOption({ label: sro });
        log(`  ✓ SRO selected via ${sel}`);
        return true;
      } catch (e) {
        log(`  ✗ Failed with ${sel}: ${(e as Error).message}`);
      }
    }
  }
  return false;
}

async function scrapeVillage(
  page: Page,
  target: { village: string; tahasil: string; sro: string }
): Promise<CircleRateRow[]> {
  log(`\n→ ${target.village} (${target.tahasil}) / ${target.sro}`);

  const results: CircleRateRow[] = [];
  const sourceDate = new Date().toISOString().split("T")[0];

  try {
    // Village/Thana free text
    const villageField = page.locator("input[id*='txtVillage'], input[id*='txtThana']").first();
    if (await villageField.count() === 0) {
      log(`  ✗ No village field found`);
      return results;
    }

    for (const kisam of KISAMS) {
      // Clear and fill village + kisam
      await villageField.fill(target.village);

      const kisamField = page.locator("input[id*='txtKisam']").first();
      if (await kisamField.count() > 0) {
        await kisamField.fill(kisam);
      }

      // Area = 1
      const areaField = page.locator("input[id*='txtArea']").first();
      if (await areaField.count() > 0) {
        await areaField.fill("1");
      }

      // Click Show
      const showButton = page.locator("input[type='submit'], a:has-text('Show')").first();
      await showButton.click();
      await page.waitForTimeout;

      // Extract rate from result panel — look for ₹ amounts
      const rateText = await page.evaluate(() => {
        const allText = document.body.innerText;
        const match = allText.match(/Per Square Feet\s*[₹:]?\s*([\d,]+)/i);
        const matchAcre = allText.match(/Per Acre\s*[₹:]?\s*([\d,]+)/i);
        const matchDec = allText.match(/Per Decimal\s*[₹:]?\s*([\d,]+)/i);
        return {
          perSqft: match ? parseInt(match[1].replace(/,/g, "")) : 0,
          perAcre: matchAcre ? parseInt(matchAcre[1].replace(/,/g, "")) : 0,
          perDecimal: matchDec ? parseInt(matchDec[1].replace(/,/g, "")) : 0,
        };
      });

      if (rateText.perSqft > 0 || rateText.perAcre > 0) {
        results.push({
          village: target.village,
          tahasil: target.tahasil,
          sro: target.sro,
          kisam,
          ratePerAcre: rateText.perAcre,
          ratePerSqft: rateText.perSqft,
          ratePerDecimal: rateText.perDecimal,
          sourceUrl: IGR_URL,
          sourceDate,
        });
        log(`    ${kisam}: ₹${rateText.perSqft}/sqft | ₹${rateText.perAcre}/acre`);
      } else {
        log(`    ${kisam}: no result`);
      }

      await page.waitForTimeout(500);
    }
  } catch (err) {
    log(`  ✗ Error: ${(err as Error).message}`);
  }

  return results;
}

async function scrapeAll() {
  log("\n=== SCRAPE MODE — Khordha circle rates ===\n");

  // Initialize log file
  const outputDir = dirname(OUTPUT_FILE);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  writeFileSync(LOG_FILE, `# IGR BMV Scrape Log\n\n`);

  const browser: Browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  page.setDefaultTimeout;

  try {
    log("[1/4] Navigating to IGR portal...");
    await page.goto(IGR_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

    log("[2/4] Selecting District = KHURDA...");
    const districtOk = await selectDistrict(page, "KHURDA");
    if (!districtOk) {
      log("✗ Could not select district. Run --probe to inspect form structure.");
      return;
    }

    const allResults: CircleRateRow[] = [];
    let lastSro = "";

    log("[3/4] Querying villages...\n");
    for (const target of TARGET_VILLAGES) {
      // Re-select SRO if it changed
      if (target.sro !== lastSro) {
        const sroOk = await selectSRO(page, target.sro);
        if (!sroOk) {
          log(`  ✗ Could not select SRO ${target.sro}, skipping ${target.village}`);
          continue;
        }
        lastSro = target.sro;
      }

      const results = await scrapeVillage(page, target);
      allResults.push(...results);
    }

    log(`\n[4/4] Writing output...`);
    writeFileSync(OUTPUT_FILE, JSON.stringify(allResults, null, 2));
    log(`  ✓ Written ${allResults.length} rows to ${OUTPUT_FILE}`);

    log(`\n=== Summary ===`);
    log(`  Villages queried: ${TARGET_VILLAGES.length}`);
    log(`  Results: ${allResults.length}`);

    if (allResults.length === 0) {
      log(`\n⚠️  No results scraped.\n`);
      log(`MANUAL FALLBACK:`);
      log(`1. Open https://igrodisha.gov.in/ViewFeeValue.aspx in your browser`);
      log(`2. For each village in TARGET_VILLAGES, query "Bari" kisam with area=1`);
      log(`3. Manually copy the "Per Square Feet" and "Per Acre" values into the JSON file`);
      log(`4. The format is:`);
      log(`   {`);
      log(`     "village": "Mendhasala",`);
      log(`     "tahasil": "Bhubaneswar",`);
      log(`     "sro": "Bhubaneswar",`);
      log(`     "kisam": "Bari",`);
      log(`     "ratePerAcre": 5000000,`);
      log(`     "ratePerSqft": 1200,`);
      log(`     "ratePerDecimal": 12000,`);
      log(`     "sourceUrl": "${IGR_URL}",`);
      log(`     "sourceDate": "${new Date().toISOString().split("T")[0]}"`);
      log(`   }`);
    } else {
      log(`\n✓ Scrape complete. Run a build to verify the fetcher consumes the new data.`);
    }
  } catch (err) {
    log(`\nFATAL: ${(err as Error).message}`);
    log(err?.stack || "");
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--probe")) {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    try {
      await probeForm(page);
    } finally {
      await browser.close();
    }
  } else if (args.includes("--scrape")) {
    await scrapeAll();
  } else {
    console.log("Usage:");
    console.log("  node scripts/probe/igr-bmv-scraper.ts --probe    # Inspect form structure");
    console.log("  node scripts/probe/igr-bmv-scraper.ts --scrape   # Run full scrape");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});