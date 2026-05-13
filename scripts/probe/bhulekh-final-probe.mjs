#!/usr/bin/env node
/**
 * Final Bhulekh village probe — gets session working, probes specific villages.
 * Uses BhulekhSession HTTP async postback pattern with retry logic.
 */
import { chromium } from "playwright";

const BASE_URL = "https://bhulekh.ori.nic.in";
const ROR_VIEW_URL = `${BASE_URL}/RoRView.aspx`;

let sessionCookies = [];
let hiddenFields = {};

async function httpRequest(url, init = {}) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    ...(init.headers || {}),
  };
  const res = await globalThis.fetch(url, { ...init, headers, credentials: "omit" });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const [nameVal] = c.split(";");
    if (nameVal && !sessionCookies.includes(nameVal)) sessionCookies.push(nameVal);
  }
  return { status: res.status, text: await res.text(), headers: res.headers };
}

function buildCookieHeader() { return sessionCookies.join("; "); }

function buildFormBody(overrides = {}) {
  const parts = [];
  for (const [k, v] of Object.entries(hiddenFields))
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  for (const [k, v] of Object.entries(overrides))
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.join("&");
}

function extractHiddenFields(html) {
  for (const m of html.matchAll(/<input[^>]+type="hidden"[^>]+>/gi)) {
    const nm = m[0].match(/name="([^"]+)"/); const v = m[0].match(/value="([^"]*)"/);
    if (nm) hiddenFields[nm[1]] = v?.[1] ?? "";
  }
  for (const m of html.matchAll(/hiddenField\|([^|]+)\|([^|]*)\|/g))
    hiddenFields[m[1]] = m[2];
}

async function postAsync(eventTarget, eventArgument = "", extraFields = {}) {
  const body = buildFormBody({
    ...extraFields,
    "ctl00$ScriptManager1": `ctl00$ContentPlaceHolder1$UpdatePanel1|${eventTarget}`,
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
  const updateMatch = res.text.match(
    /updatePanel\|[^|]*\|([\s\S]*?)(?=\|\d+\|hiddenField\||\|\d+\|scriptBlock\||\|asyncPostBackControlIDs\|$)/i
  );
  return { raw: res.text, updatePanelHtml: updateMatch?.[1] };
}

function extractSelectOptions(html, selectName) {
  const opts = [];
  const match = html.match(
    new RegExp(`<select[^>]+name=["']${selectName.replace(/\$/g, '\\$')}["'][^>]*>([\\s\\S]*?)</select>`, "gi")
  );
  if (!match) return opts;
  for (const sel of match) {
    for (const m of sel.matchAll(/<option[^>]+value="([^"]*)"[^>]*>([^<]*)<\/option>/gi))
      opts.push({ value: m[1].trim(), text: m[2].replace(/\s+/g, " ").trim() });
  }
  return opts;
}

async function bootstrap() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  });

  console.log("Bootstrapping session...");
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(ROR_VIEW_URL, { waitUntil: "commit", timeout: 45000 });
      break;
    } catch (e) {
      console.log(`  Attempt ${attempt} failed: ${e.message.split('\n')[0]}`);
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  if (page.url().includes("BhulekhError.aspx")) {
    console.log("  On error page — clicking 'here'...");
    await page.click('a:has-text("here")', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout;
  }

  await page.waitForSelector("#ctl00_ContentPlaceHolder1_ddlDistrict", { timeout: 15000 }).catch(() => {});

  const cookies = await page.context().cookies(ROR_VIEW_URL).catch(() => []);
  sessionCookies = cookies.map(c => `${c.name}=${c.value}`);
  const hf = await page.evaluate(() => {
    const fields = {};
    document.querySelectorAll('input[type="hidden"]').forEach(el => { fields[el.name] = el.value; });
    return fields;
  }).catch(() => ({}));
  hiddenFields = { ...hf };
  console.log(`  Cookies: ${sessionCookies.length}, Hidden fields: ${Object.keys(hiddenFields).length}`);
  await browser.close();
}

async function selectDistrict(code = "20") {
  const delta = await postAsync("ctl00$ContentPlaceHolder1$ddlDistrict", "", {
    "ctl00$ContentPlaceHolder1$ddlDistrict": code,
  });
  await new Promise(r => setTimeout(r, 1000));

  const fullPage = await httpRequest(ROR_VIEW_URL, {
    headers: { "Cookie": buildCookieHeader(), "Referer": ROR_VIEW_URL }
  });
  extractHiddenFields(fullPage.text);
  const allTahasils = extractSelectOptions(fullPage.text, "ddlTahsil");
  console.log(`  District ${code}: ${allTahasils.length} tahasils`);
  for (const t of allTahasils.slice(0, 15)) {
    console.log(`    [${t.value}] "${t.text}"`);
  }
  return allTahasils;
}

async function getVillagesForTahasil(tahCode, tahText) {
  const delta = await postAsync("ctl00$ContentPlaceHolder1$ddlTahsil", "", {
    "ctl00$ContentPlaceHolder1$ddlDistrict": "20",
    "ctl00$ContentPlaceHolder1$ddlTahsil": tahCode,
  });
  await new Promise(r => setTimeout(r, 500));

  let villageOpts = [];
  if (delta.updatePanelHtml) villageOpts = extractSelectOptions(delta.updatePanelHtml, "ddlVillage");
  if (villageOpts.length === 0) {
    const full = await httpRequest(ROR_VIEW_URL, {
      headers: { "Cookie": buildCookieHeader(), "Referer": ROR_VIEW_URL }
    });
    extractHiddenFields(full.text);
    villageOpts = extractSelectOptions(full.text, "ddlVillage");
  }

  console.log(`\n  ${tahText} [${tahCode}]: ${villageOpts.length} villages`);
  return villageOpts;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  Bhulekh Final Village Probe                 ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  await bootstrap();

  // Get all tahasils
  const allTahasils = await selectDistrict("20");

  // Target villages we need to find
  const targets = [
    "Sangram", "Mandara", "Gothapada", "Kudi", "Dhaulimunda",
    "Balipatna", "Dhaulipur", "Kakatpur", "Naikendud",
    "Banapur", "Khurda", "Bhagabatipur",
  ];

  // Romanizations for matching
  const romMap = {
    "Sangram": ["sangram", "sanagram", "singram"],
    "Mandara": ["mandara", "mondara", "mandra"],
    "Gothapada": ["gothapada", "gotapada", "gothpada"],
    "Kudi": ["kudi", "koodi"],
    "Dhaulimunda": ["dhaulimunda", "dholimunda", "dulumunda"],
    "Balipatna": ["balipatna", "balipatan", "ballipatna"],
    "Dhaulipur": ["dhaulipur", "dholipur", "dolipur"],
    "Kakatpur": ["kakatpur", "kakatpur", "kaktpur"],
    "Naikendud": ["naikendud", "naikendud", "naikendud"],
    "Banapur": ["banapur", "bhanapur", "vanapur"],
    "Khurda": ["khurda", "khorda", "khurd"],
    "Bhagabatipur": ["bhagabatipur", "bhagavathipur", "bhagbatipur"],
  };

  // Probe all tahasils
  console.log("\n\nProbing all tahasils for target villages...\n");
  const found = {};

  for (const tah of allTahasils) {
    if (!tah.value || tah.value === "Select Tahasil") continue;

    const villages = await getVillagesForTahasil(tah.value, tah.text);

    for (const v of villages) {
      if (v.value === "Select Village") continue;
      const vLower = v.text.toLowerCase().replace(/\s+/g, "");
      const vRoman = romanize(v.text).toLowerCase().replace(/[^a-z]/g, "");

      for (const target of targets) {
        if (found[target]) continue;
        const roms = romMap[target] || [target.toLowerCase()];
        for (const rom of roms) {
          if (vLower.includes(rom) || vRoman.includes(rom) ||
              vLower.replace(/\s/g, "").includes(rom) ||
              lev(vRoman, rom) <= 2) {
            found[target] = { ...v, tahasil: tah.text, tahasilCode: tah.value };
            console.log(`\n  ★ FOUND: "${target}" = [${v.value}] "${v.text}" in ${tah.text} [${tah.value}]`);
            console.log(`    romanized: "${vRoman}"`);
            break;
          }
        }
      }
    }
  }

  // Summary
  console.log("\n\n╔══════════════════════════════════════════════════╗");
  console.log("║  RESULTS SUMMARY                             ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("\nVillage,Code,Tahasil,TahasilCode,Odia");
  for (const [name, data] of Object.entries(found)) {
    console.log(`${name},${data.value},"${data.tahasil}",${data.tahasilCode},"${data.odia}"`);
  }
  console.log(`\nFound: ${Object.keys(found).length}/${targets.length}`);
  const missing = targets.filter(t => !found[t]);
  if (missing.length > 0) {
    console.log(`Missing: ${missing.join(", ")}`);
    console.log("\nThese villages may not exist in Bhulekh's digital records.");
    console.log("They may be: merged into other villages, renamed, or not yet digitized.");
  }
}

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
  let r = '';
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

main().catch(e => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
