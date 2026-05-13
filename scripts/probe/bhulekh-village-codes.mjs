#!/usr/bin/env node
/**
 * Probe Bhulekh village dropdown values using the working BhulekhSession pattern:
 * - Playwright: bootstrap session (cookies + hidden fields)
 * - HTTP async postbacks: drive the dropdown cascade
 *
 * This correctly triggers ASP.NET UpdatePanel async postbacks.
 */
import { chromium } from "playwright";

const BASE_URL = "https://bhulekh.ori.nic.in";
const ROR_VIEW_URL = `${BASE_URL}/RoRView.aspx`;

let sessionCookies = [];
let hiddenFields = {};

// ─── HTTP helpers (from BhulekhSession) ─────────────────────────────────────
async function httpRequest(url, init = {}) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    ...(init.headers || {}),
  };

  const res = await globalThis.fetch(url, {
    ...init,
    headers,
    credentials: "omit",
  });

  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookie) {
    const [nameVal] = cookie.split(";");
    if (nameVal && !sessionCookies.includes(nameVal)) {
      sessionCookies.push(nameVal);
    }
  }

  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

function buildCookieHeader() {
  return sessionCookies.join("; ");
}

function buildFormBody(overrides = {}) {
  const parts = [];
  for (const [k, v] of Object.entries(hiddenFields)) {
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  for (const [k, v] of Object.entries(overrides)) {
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  return parts.join("&");
}

function extractHiddenFields(html) {
  for (const match of html.matchAll(/<input[^>]+type="hidden"[^>]+>/gi)) {
    const input = match[0];
    const nameMatch = input.match(/name="([^"]+)"/);
    const valueMatch = input.match(/value="([^"]*)"/);
    if (nameMatch) {
      hiddenFields[nameMatch[1]] = valueMatch?.[1] ?? "";
    }
  }
  for (const match of html.matchAll(/hiddenField\|([^|]+)\|([^|]*)\|/g)) {
    hiddenFields[match[1]] = match[2];
  }
}

function parseDelta(text) {
  const newHidden = {};
  for (const match of text.matchAll(/hiddenField\|([^|]+)\|([^|]*)\|/g)) {
    newHidden[match[1]] = match[2];
  }

  const redirectMatch = text.match(/pageRedirect\|\|([^|]+)/);
  const redirectPath = redirectMatch ? decodeURIComponent(redirectMatch[1]) : undefined;

  const updatePanelMatch = text.match(
    /updatePanel\|[^|]*\|([\s\S]*?)(?=\|\d+\|hiddenField\||\|\d+\|scriptBlock\||\|asyncPostBackControlIDs\|$)/i
  );

  return {
    redirectPath,
    updatePanelHtml: updatePanelMatch?.[1],
    newHiddenFields: newHidden,
    raw: text,
  };
}

async function postAsync(eventTarget, eventArgument = "", extraFields = {}) {
  const scriptManager = `ctl00$ContentPlaceHolder1$UpdatePanel1|${eventTarget}`;
  const body = buildFormBody({
    ...extraFields,
    "ctl00$ScriptManager1": scriptManager,
    "__EVENTTARGET": eventTarget,
    "__EVENTARGUMENT": eventArgument,
  });

  const res = await httpRequest(ROR_VIEW_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-microsoftajax": "Delta=true",
      "x-requested-with": "XMLHttpRequest",
      "Referer": ROR_VIEW_URL,
      "Cookie": buildCookieHeader(),
    },
    body,
  });

  extractHiddenFields(res.text);
  return parseDelta(res.text);
}

// ─── Extract select options from HTML / delta ────────────────────────────────
function extractSelectOptions(html, selectId) {
  const options = [];
  // Try by name attribute
  const byName = new RegExp(
    `<select[^>]+name=["']${selectId.replace(/\$/g, '\\$')}["'][^>]*>([\\s\\S]*?)</select>`,
    "gi"
  );
  let match = byName.exec(html);
  if (!match) {
    // Try by partial name
    const partial = selectId.split("$").pop();
    const byId = new RegExp(
      `<select[^>]+id=["'][^"']*${partial}[^"']*["'][^>]*>([\\s\\S]*?)</select>`,
      "gi"
    );
    match = byId.exec(html);
  }
  if (!match) return options;

  const optionsHtml = match[1];
  for (const optMatch of optionsHtml.matchAll(/<option[^>]+value="([^"]*)"[^>]*>([^<]*)<\/option>/gi)) {
    options.push({
      value: optMatch[1].trim(),
      text: optMatch[2].replace(/\s+/g, " ").trim(),
    });
  }
  return options;
}

// ─── Levenshtein ──────────────────────────────────────────────────────────────
function lev(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

// ─── Main ───────────────────────────────────────────────────────────────────
const TARGET_VILLAGES = [
  // Bhubaneswar tahasil
  "Jatni", "Sangram", "Gothapada", "Mandara", "Sijua",
  "Bhagabatipur", "Kudi", "Dhaulimunda", "Brahmanabilen",
  // Balianta tahasil
  "Balipatna", "Dhaulipur", "Gopalpur", "Kakatpur", "Naikendud",
  // Balugaon tahasil
  "Balugaon", "Banapur", "Nuagaon", "Ranapur", "Khurda",
  // Already known
  "Chandaka", "Mendhasala", "Haripur",
];

async function main() {
  console.log("=== Bhulekh Village Code Probe ===\n");

  // Step 1: Playwright bootstrap
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  });

  console.log("1. Playwright: bootstrapping session...");
  await page.goto(ROR_VIEW_URL, { waitUntil: "commit", timeout: 60000 });

  if (page.url().includes("BhulekhError.aspx")) {
    console.log("   On BhulekhError.aspx — clicking 'here'...");
    await page.click('a:has-text("here")', { timeout: 15000 });
    await page.waitForTimeout(500);
  }

  await page.waitForSelector("#ctl00_ContentPlaceHolder1_ddlDistrict", { timeout: 15000 });

  // Extract cookies and hidden fields
  const cookies = await page.context().cookies(ROR_VIEW_URL);
  sessionCookies = cookies.map(c => `${c.name}=${c.value}`);

  const hf = await page.evaluate(() => {
    const fields = {};
    document.querySelectorAll('input[type="hidden"]').forEach(el => {
      fields[el.name] = el.value;
    });
    return fields;
  });
  hiddenFields = { ...hf };

  console.log(`   Cookies: ${sessionCookies.length}, Hidden fields: ${Object.keys(hiddenFields).length}`);
  await browser.close();

  // Step 2: Select district 20 via HTTP async postback
  console.log("\n2. HTTP: selecting district 20 (Khordha)...");
  const districtDelta = await postAsync("ctl00$ContentPlaceHolder1$ddlDistrict", "", {
    "ctl00$ContentPlaceHolder1$ddlDistrict": "20",
  });
  console.log(`   Delta raw length: ${districtDelta.raw.length}`);

  // Extract tahasil options from the delta's update panel
  let tahasilOpts = [];
  if (districtDelta.updatePanelHtml) {
    tahasilOpts = extractSelectOptions(districtDelta.updatePanelHtml, "ddlTahsil");
  }
  if (tahasilOpts.length === 0) {
    // Fall back to hidden field updates for the select element
    const selectHtmlMatch = districtDelta.raw.match(/<select[^>]+id=["'][^"']*ddlTahsil[^"']*["'][^>]*>([\s\S]*?)<\/select>/i);
    if (selectHtmlMatch) {
      for (const optMatch of selectHtmlMatch[1].matchAll(/<option[^>]+value="([^"]*)"[^>]*>([^<]*)<\/option>/gi)) {
        tahasilOpts.push({ value: optMatch[1].trim(), text: optMatch[2].replace(/\s+/g, " ").trim() });
      }
    }
  }
  if (tahasilOpts.length === 0) {
    // Last resort: fetch full page and parse
    console.log("   Falling back to full-page fetch...");
    const fullPage = await httpRequest(ROR_VIEW_URL, {
      headers: { "Cookie": buildCookieHeader(), "Referer": ROR_VIEW_URL }
    });
    extractHiddenFields(fullPage.text);
    tahasilOpts = extractSelectOptions(fullPage.text, "ddlTahsil");
  }

  console.log(`\n3. Found ${tahasilOpts.length} tahasil options:`);
  for (const o of tahasilOpts) {
    console.log(`   [${o.value}] "${o.text}"`);
  }

  // Step 3: For each tahasil, extract villages
  const allResults = {};

  for (const tahasilOpt of tahasilOpts) {
    console.log(`\n4. Processing tahasil: "${tahasilOpt.text}" [${tahasilOpt.value}]`);

    // Select this tahasil
    const tahasilDelta = await postAsync("ctl00$ContentPlaceHolder1$ddlTahsil", "", {
      "ctl00$ContentPlaceHolder1$ddlDistrict": "20",
      "ctl00$ContentPlaceHolder1$ddlTahsil": tahasilOpt.value,
    });

    // Extract village options
    let villageOpts = [];
    if (tahasilDelta.updatePanelHtml) {
      villageOpts = extractSelectOptions(tahasilDelta.updatePanelHtml, "ddlVillage");
    }
    if (villageOpts.length === 0) {
      const selectHtmlMatch = tahasilDelta.raw.match(/<select[^>]+id=["'][^"']*ddlVillage[^"']*["'][^>]*>([\s\S]*?)<\/select>/gi);
      if (selectHtmlMatch) {
        for (const selMatch of selectHtmlMatch) {
          for (const optMatch of selMatch.matchAll(/<option[^>]+value="([^"]*)"[^>]*>([^<]*)<\/option>/gi)) {
            villageOpts.push({
              value: optMatch[1].trim(),
              text: optMatch[2].replace(/\s+/g, " ").trim(),
            });
          }
        }
      }
    }

    console.log(`   Villages found: ${villageOpts.length}`);
    allResults[tahasilOpt.text] = { code: tahasilOpt.value, villages: villageOpts };

    // Print first few villages for debugging
    if (villageOpts.length > 0 && villageOpts.length <= 10) {
      for (const v of villageOpts) {
        console.log(`     [${v.value}] "${v.text}"`);
      }
    } else if (villageOpts.length > 10) {
      console.log(`     First 5: ${villageOpts.slice(0, 5).map(v => `[${v.value}] "${v.text}"`).join(", ")}`);
    }
  }

  // Step 4: Print ALL villages per tahasil (for full reference)
  console.log("\n\n=== ALL VILLAGES BY TAHAZIL ===");
  for (const [tahasilName, data] of Object.entries(allResults)) {
    if (data.villages.length === 0) continue;
    console.log(`\n--- ${tahasilName} [${data.code}] (${data.villages.length} villages) ---`);
    for (const v of data.villages) {
      if (v.value !== "Select Village") {
        console.log(`  [${v.value}] "${v.text}"`);
      }
    }
  }

  // Step 5: Also print the current villages.ts entries for reference
  console.log("\n\n=== CURRENT VILLAGES.TS (for comparison) ===");
  const villagesTsOdia = [
    ["Mendhasala", "ମେଣ୍ଢାଶାଳ", "Bhubaneswar", "105"],
    ["Chandaka", "ଚଣ୍ଡକା", "Bhubaneswar", "2"],
    ["Haripur", "ହରୀପୁର", "Bhubaneswar", "2"],
    ["Jatni", "ଯାତନୀ", "Bhubaneswar", "?"],
    ["Sangram", "ସଂଗ୍ରାମ", "Bhubaneswar", "?"],
    ["Gothapada", "ଗୋଠପଦା", "Bhubaneswar", "?"],
    ["Mandara", "ମନ୍ଦର", "Bhubaneswar", "?"],
    ["Sijua", "ସିଜୁଆ", "Bhubaneswar", "301"],
    ["Bhagabatipur", "ଭଗବତୀପୁର", "Bhubaneswar", "?"],
    ["Kudi", "କୁଡି", "Bhubaneswar", "?"],
    ["Dhaulimunda", "ଧଉଳୀମୁଣ୍ଡ", "Bhubaneswar", "?"],
    ["Brahmanabilen", "ବ୍ରାହ୍ମଣ ବିଲ", "Bhubaneswar", "?"],
    ["Balipatna", "ବଳିପାଟଣା", "Balianta", "?"],
    ["Dhaulipur", "ଧଉଳୀପୁର", "Balianta", "?"],
    ["Gopalpur", "ଗୋପାଳପୁର", "Balianta", "?"],
    ["Kakatpur", "କାକାଟପୁର", "Balianta", "?"],
    ["Nayakendud", "ନାୟକେଣ୍ଡୁଦ", "Balianta", "?"],
    ["Balugaon", "ବାଲୁଗାଁ", "Balugaon", "43"],
    ["Banapur", "ବଣପୁର", "Balugaon", "?"],
    ["Nuagaon", "ନୁଆଗାଁ", "Balugaon", "?"],
    ["Ranapur", "ରଣପୁର", "Balugaon", "?"],
    ["Khurda", "ଖୁର୍ଦ", "Balugaon", "?"],
  ];
  for (const [en, od, tah, code] of villagesTsOdia) {
    console.log(`  ${en} (${od}) in ${tah} — current code: ${code}`);
  }
}

main().catch(err => {
  console.error("ERROR:", err.message);
  console.error(err.stack);
  process.exit(1);
});
