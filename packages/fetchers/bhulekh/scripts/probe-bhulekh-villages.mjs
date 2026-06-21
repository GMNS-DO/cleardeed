#!/usr/bin/env node
/**
 * Bhulekh Odisha live-site probe — full Khordha village directory dump.
 *
 * Boots Bhulekh's RoRView page in Playwright, selects district=Khordha (20),
 * then for each of the 10 tahasils selects the tahasil, waits for the
 * village dropdown to populate, and reads every option. Writes the result
 * to data/khordha_villages.json plus a probe-result.json summary.
 *
 * Exit code:
 *   0 — successful probe with all 10 tahasils dumped (1,400+ villages)
 *   1 — partial probe (some tahasils missing) — JSON still written
 *   2 — total failure (no session established)
 *
 * Usage:
 *   node scripts/probe-bhulekh-villages.mjs                # run full probe
 *   node scripts/probe-bhulekh-villages.mjs --tahasil 2    # single tahasil
 *   node scripts/probe-bhulekh-villages.mjs --dry-run      # log only
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = join(__dirname, "..");
const DATA_DIR = join(PACKAGE_ROOT, "data");

const BHULEKH_URL = "https://bhulekh.ori.nic.in";
const ROR_VIEW_URL = `${BHULEKH_URL}/RoRView.aspx`;
const DISTRICT_CODE = "20"; // Khordha

// Codes per file-header claim (re-verified 2026-05-01 probe)
const TAHASIL_CODES = {
  1: "Banapur",
  2: "Bhubaneswar",
  3: "Kordha",
  4: "Begunia",
  5: "Bolgarh",
  6: "Jatni",
  7: "Tangi",
  8: "Balianta",
  9: "Balipatna",
  10: "Chilika",
};

function parseArgs(argv) {
  const out = { tahasil: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tahasil") {
      const v = argv[++i];
      out.tahasil = /^\d+$/.test(v) ? parseInt(v, 10) : v;
    } else if (a === "--dry-run") {
      out.dryRun = true;
    }
  }
  return out;
}

async function readSelectOptions(page, selector) {
  try {
    await page.waitForSelector(selector, { state: "attached", timeout: 10_000 });
  } catch {
    return [];
  }
  return page.locator(selector).evaluateAll((nodes) => {
    const select = nodes[0];
    if (!select) return [];
    return Array.from(select.options).map((option) => ({
      value: option.value,
      text: (option.textContent ?? "").replace(/\s+/g, " ").trim(),
    }));
  });
}

function filterOdia(text) {
  // Detect whether the option text is in Odia script. Returns the script portion.
  const odia = text.match(/[଀-୿]+/g);
  return odia ? odia.join(" ").trim() : "";
}

function filterEnglish(text) {
  // Strip Odia portion and any leading numbers/whitespace.
  const stripped = text.replace(/[଀-୿]+/g, "").trim();
  // Some entries are pure Odia with no English — return "" in that case.
  return stripped;
}

async function probeTahasil(page, tahasilCode) {
  console.log(`[probe] tahasil ${tahasilCode} (${TAHASIL_CODES[tahasilCode] ?? "?"}): selecting...`);
  await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", String(tahasilCode));
  // Village dropdown is populated by browser JS — wait until it has entries.
  let villages = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    await page.waitForTimeout(500);
    villages = await readSelectOptions(page, "#ctl00_ContentPlaceHolder1_ddlVillage");
    const valid = villages.filter((v) => v.value && v.value !== "0" && v.value !== "");
    if (valid.length > 0) {
      villages = valid;
      break;
    }
  }
  console.log(`[probe] tahasil ${tahasilCode}: ${villages.length} village options`);

  const rows = [];
  for (const v of villages) {
    // Filter placeholder / invalid entries.
    if (!v.value || v.value === "0") continue;
    if (!/^\d+$/.test(v.value)) continue; // discard "Select Village" / "Select" etc.
    const odia = filterOdia(v.text);
    const english = filterEnglish(v.text);
    rows.push({
      bhulekhVillageCode: v.value,
      english,
      odia,
      tahasil: TAHASIL_CODES[tahasilCode] ?? null,
      bhulekhTahasilCode: String(tahasilCode),
    });
  }
  return rows;
}

async function main() {
  const args = parseArgs(process.argv);
  mkdirSync(DATA_DIR, { recursive: true });

  const tahasilFilter = args.tahasil;
  const tahasilList = tahasilFilter
    ? [typeof tahasilFilter === "number" ? tahasilFilter : null].filter((n) => n !== null)
    : Object.keys(TAHASIL_CODES).map((k) => parseInt(k, 10));

  console.log(`[probe] Booting Chromium...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  });
  const page = await context.newPage();

  let sessionOk = false;
  try {
    console.log(`[probe] Navigating to ${ROR_VIEW_URL}`);
    await page.goto(ROR_VIEW_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });

    if (page.url().includes("BhulekhError.aspx")) {
      console.log(`[probe] On error page, following 'here' link...`);
      await page.locator("a", { hasText: "here" }).click();
      await page.waitForURL(/RoRView\.aspx/, { timeout: 30_000 });
    }

    // Wait for district dropdown to populate.
    let districtOpts = [];
    for (let attempt = 0; attempt < 30; attempt++) {
      await page.waitForTimeout(500);
      districtOpts = await readSelectOptions(page, "#ctl00_ContentPlaceHolder1_ddlDistrict");
      if (districtOpts.filter((o) => o.value && o.value !== "0").length > 0) break;
    }
    console.log(`[probe] District dropdown: ${districtOpts.length} options`);

    // Select Khordha.
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", DISTRICT_CODE);
    await page.waitForTimeout(750);

    const districtAfter = await readSelectOptions(page, "#ctl00_ContentPlaceHolder1_ddlDistrict");
    console.log(`[probe] After district select: ${districtAfter.length} options`);

    const tahasilOpts = await readSelectOptions(page, "#ctl00_ContentPlaceHolder1_ddlTahsil");
    const validTahasils = tahasilOpts.filter((t) => t.value && t.value !== "0" && t.value !== "");
    console.log(`[probe] Tahasil dropdown: ${validTahasils.length} options`);

    if (validTahasils.length === 0) {
      throw new Error("No tahasils populated after district select.");
    }
    sessionOk = true;

    const allVillages = [];
    const perTahasil = {};
    for (const code of tahasilList) {
      const rows = await probeTahasil(page, code);
      perTahasil[code] = rows.length;
      allVillages.push(...rows);
    }

    // Write the directory JSON
    const outFile = join(DATA_DIR, "khordha_villages.json");
    const payload = {
      probedAt: new Date().toISOString(),
      district: "Khordha",
      districtCode: DISTRICT_CODE,
      tahasilCount: tahasilList.length,
      totalVillages: allVillages.length,
      perTahasilCount: perTahasil,
      villages: allVillages,
    };
    writeFileSync(outFile, JSON.stringify(payload, null, 2));
    console.log(`[probe] Wrote ${allVillages.length} villages to ${outFile}`);

    const summaryFile = join(PACKAGE_ROOT, "fixtures", "villages-probe-result.json");
    mkdirSync(dirname(summaryFile), { recursive: true });
    writeFileSync(summaryFile, JSON.stringify({
      ...payload,
      villages: undefined, // omit the heavy list from the summary file
      perTahasilCount: perTahasil,
      totalVillages: allVillages.length,
      sessionOk: true,
    }, null, 2));
    console.log(`[probe] Summary at ${summaryFile}`);

    await browser.close();
    return allVillages.length >= 1000 ? 0 : 1;
  } catch (err) {
    console.error(`[probe] FAILED:`, err?.message ?? String(err));
    const failFile = join(PACKAGE_ROOT, "fixtures", "villages-probe-result.json");
    mkdirSync(dirname(failFile), { recursive: true });
    writeFileSync(failFile, JSON.stringify({
      probedAt: new Date().toISOString(),
      sessionOk,
      error: err?.message ?? String(err),
      totalVillages: 0,
    }, null, 2));
    await browser.close().catch(() => undefined);
    return sessionOk ? 1 : 2;
  }
}

main().then((code) => process.exit(code));