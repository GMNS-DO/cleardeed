#!/usr/bin/env node
/**
 * Bhulekh village probe — single browser session for full dropdown cascade.
 * Solves the village-dropdown problem: village options are populated by browser JS,
 * not by ASP.NET AJAX. Use Playwright to select district→tahasil→read villages.
 */
import { chromium } from "playwright";

const ROR_VIEW_URL = "https://bhulekh.ori.nic.in/RoRView.aspx";
const BOOTSTRAP_TIMEOUT = 40_000;
const NAVIGATION_TIMEOUT = 25_000;
const POST_SELECTION_DELAY_MS = 1200;

let cookies = [];
let hiddenFields = {};

function romanize(odia) {
  const map = {
    'ଅ':'a','ଆ':'aa','ଇ':'i','ଈ':'ii','ଉ':'u','ଊ':'uu','ଋ':'ri',
    'ଏ':'e','ଐ':'ai','ଓ':'o','ଔ':'au',
    'କ':'k','ଖ':'kh','ଗ':'g','ଘ':'gh','ଙ':'ng',
    'ଚ':'ch','ଛ':'chh','ଜ':'j','ଝ':'jh','ଞ':'nj',
    'ଟ':'t','ଠ':'th','ଡ':'d','ଢ':'dh','ଣ':'n',
    'ତ':'t','ଥ':'th','ଦ':'d','ଧ':'dh','ନ':'n',
    'ପ':'p','ଫ':'ph','ବ':'b','ଭ':'bh','ମ':'m',
    'ଯ':'j','ର':'r','ଲ':'l','ଳ':'l','ଶ':'sh','ଷ':'sh','ସ':'s','ହ':'h',
    '଼':'n','ଁ':'n','ଂ':'ng','ଃ':'h',
    '୍':'','୦':'0','୧':'1','୨':'2','୩':'3','୪':'4',
    '୫':'5','୬':'6','୭':'7','୮':'8','୯':'9',
    'ା':'a','ି':'i','ୀ':'ii','ୁ':'u','ୂ':'uu',
    'ୃ':'ri','େ':'e','ୈ':'ai','ୋ':'o','ୌ':'au',
  };
  let r = "";
  for (const c of odia) r += map[c] || c;
  return r;
}

function lev(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({length:m+1},(_,i)=>[i]);
  for (let j=0;j<=n;j++) dp[0][j]=j;
  for (let i=1;i<=m;i++) for (let j=1;j<=n;j++)
    dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[m][n];
}

function matchVillage(query, candidateText) {
  const qRom = romanize(query).replace(/[^a-z]/g, "");
  const cRom = romanize(candidateText).replace(/[^a-z]/g, "");

  if (!qRom || !cRom || qRom.length < 2 || cRom.length < 2) return null;

  if (qRom === cRom && qRom.length > 3) return { score: 95, method: "exact_rom" };
  if (cRom.includes(qRom) && qRom.length >= 3) return { score: 75, method: "rom_substr" };
  if (qRom.includes(cRom) && cRom.length >= 3) return { score: 70, method: "rom_prefix" };
  const d = lev(qRom, cRom);
  const maxLen = Math.max(qRom.length, cRom.length);
  if (d <= 2 && maxLen >= 4) return { score: 60 - d * 5, method: "levenshtein" };
  if (d <= 3 && maxLen >= 6) return { score: 50 - d * 5, method: "levenshtein" };
  return null;
}

async function readSelectOptions(page, selectSelector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return [];
    return Array.from(el.options).map(o => ({ value: o.value, text: o.text.trim() }));
  }, selectSelector);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║  Bhulekh Village Probe — 12 Missing Villages        ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // ── Launch single browser session ─────────────────────────────────────
  console.log("Bootstrapping browser session...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(ROR_VIEW_URL, { waitUntil: "commit", timeout: BOOTSTRAP_TIMEOUT });
      break;
    } catch (e) {
      console.log(`  Attempt ${attempt} failed: ${e.message.split("\n")[0]}`);
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  if (page.url().includes("BhulekhError")) {
    console.log("  On error page — clicking 'here'...");
    try {
      await page.locator("a", { hasText: /here/i }).first().click({ timeout: 8000 });
      await page.waitForTimeout(500);
    } catch (e) { console.log(`  'here' click failed: ${e.message.split("\n")[0]}`); }
  }

  try {
    await page.waitForSelector("#ctl00_ContentPlaceHolder1_ddlDistrict", { timeout: 12000 });
  } catch (e) {
    console.error("ERROR: District dropdown not found");
    await browser.close();
    return;
  }

  // Capture session cookies
  const pageCookies = await context.cookies(ROR_VIEW_URL).catch(() => []);
  cookies = pageCookies.map(c => `${c.name}=${c.value}`);
  console.log(`  Session ready. Cookies: ${cookies.length}`);
  console.log(`  URL: ${page.url()}`);

  // Capture hidden fields
  hiddenFields = await page.evaluate(() => {
    const fields = {};
    document.querySelectorAll("input[type=hidden]").forEach(el => { fields[el.name] = el.value; });
    return fields;
  }).catch(() => ({}));
  console.log(`  Hidden fields: ${Object.keys(hiddenFields).length}`);

  // Read all district options
  const districtOpts = await readSelectOptions(page, "#ctl00_ContentPlaceHolder1_ddlDistrict");
  const khordhaOpt = districtOpts.find(o => o.text.includes("ଖୋର୍ଦ୍ଧା") || o.text.includes("Khordha") || o.value === "20");
  console.log(`  Districts found: ${districtOpts.length}`);
  console.log(`  Khordha: ${khordhaOpt ? khordhaOpt.value + ' "' + khordhaOpt.text + '"' : "not found"}`);

  if (!khordhaOpt) {
    console.error("ERROR: Khordha district not found in dropdown");
    await browser.close();
    return;
  }

  // Select Khordha (district code 20)
  console.log("\nSelecting district 20...");
  await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", khordhaOpt.value).catch(e => {
    console.error(`  District select failed: ${e.message}`);
  });
  await page.waitForTimeout(POST_SELECTION_DELAY_MS);

  // Read tahasil options
  const tahasilOpts = await readSelectOptions(page, "#ctl00_ContentPlaceHolder1_ddlTahsil");
  console.log(`  Tahasils: ${tahasilOpts.length}`);
  for (const opt of tahasilOpts.filter(o => o.value)) {
    console.log(`    [${opt.value}] "${opt.text}"`);
  }

  if (tahasilOpts.length === 0) {
    console.error("\nERROR: No tahasils loaded. Bhulekh may require a full page reload with session cookies.");
    console.error("Cannot proceed — need browser JS to populate tahasil dropdown.");
    await browser.close();
    return;
  }

  // Target villages (Census 2011 Odia spellings)
  const targets = [
    { name: "Mendhasala",   odia: "ମେଣ୍ଢାଶାଳ" },  // Known working — verify first
    { name: "Sangram",      odia: "ସଂଗ୍ରାମ" },
    { name: "Mandara",      odia: "ମନ୍ଦର" },
    { name: "Gothapada",    odia: "ଗୋଠପଦା" },
    { name: "Kudi",         odia: "କୁଡି" },
    { name: "Dhaulimunda",  odia: "ଧଉଳୀମୁଣ୍ଡ" },
    { name: "Balipatna",    odia: "ବଳିପାଟଣା" },
    { name: "Dhaulipur",    odia: "ଧଉଳୀପୁର" },
    { name: "Kakatpur",     odia: "କାକତପୁର" },
    { name: "Naikendud",    odia: "ନାଇକେଣ୍ଦୁଡ" },
    { name: "Banapur",      odia: "ବାଣାପୁର" },
    { name: "Khurda",       odia: "ଖୁର୍ଦା" },
    { name: "Bhagabatipur", odia: "ଭଗବତୀପୁର" },
  ];

  console.log(`\n\nSearching ${tahasilOpts.filter(o => o.value).length} tahasils for ${targets.length} villages...\n`);

  const results = {};
  const realTahasils = tahasilOpts.filter(o => o.value && o.value !== "Select Tahasil");
  let tahasilCount = 0;

  for (const tah of realTahasils) {
    tahasilCount++;
    console.log(`[${tahasilCount}/${realTahasils.length}] ${tah.text} (${tah.value})...`);

    try {
      // Select tahasil
      await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", tah.value).catch(() => {});
      await page.waitForTimeout(POST_SELECTION_DELAY_MS);

      // Read village options
      const villageOpts = await readSelectOptions(page, "#ctl00_ContentPlaceHolder1_ddlVillage");
      console.log(`  → ${villageOpts.length} villages`);

      if (villageOpts.length > 0) {
        // Show first 5 for debugging
        for (const v of villageOpts.slice(0, 3)) {
          if (v.value && v.value !== "Select Village") {
            console.log(`    [${v.value}] "${v.text}"`);
          }
        }
      }

      // Search for target villages
      for (const v of villageOpts) {
        if (!v.value || v.value === "Select Village") continue;
        for (const target of targets) {
          if (results[target.name]) continue;
          const result = matchVillage(target.odia, v.text);
          if (result && result.score >= 45) {
            results[target.name] = {
              code: v.value,
              text: v.text,
              tahasil: tah.text,
              tahasilCode: tah.value,
              score: result.score,
              method: result.method,
            };
            console.log(`  ★ "${target.name}" = [${v.value}] "${v.text}" (${result.method}, score=${result.score})`);
          }
        }
      }
    } catch (e) {
      console.log(`  Error: ${e.message.split("\n")[0]}`);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  RESULTS SUMMARY                                    ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("\nVillage,CensusOdia,Code,Tahasil,TahasilCode,MatchMethod,Score");
  for (const [name, data] of Object.entries(results)) {
    const target = targets.find(t => t.name === name);
    console.log(`${name},"${target?.odia || ""}",${data.code},"${data.tahasil}",${data.tahasilCode},${data.method},${data.score}`);
  }

  const missing = targets.filter(t => !results[t.name]);
  console.log(`\nFound: ${Object.keys(results).length}/${targets.length}`);
  if (missing.length > 0) {
    console.log(`MISSING: ${missing.map(t => `${t.name} (${t.odia})`).join(", ")}`);
    console.log("\nThese villages may not be digitized in Bhulekh, or have different spellings.");
  }

  // villages.ts additions
  console.log("\n=== villages.ts additions ===");
  for (const [name, data] of Object.entries(results)) {
    const target = targets.find(t => t.name === name);
    console.log(`  "${target?.odia || name}": { code: "${data.code}", tahasil: "${data.tahasil}" }, // ${name} (tahasil code ${data.tahasilCode})`);
  }

  await browser.close();
}

main().catch(e => {
  console.error("ERROR:", e.message.split("\n")[0]);
  process.exit(1);
});