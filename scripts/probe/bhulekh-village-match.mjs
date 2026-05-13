#!/usr/bin/env node
/**
 * Comprehensive Bhulekh village matcher.
 * Uses multiple strategies to find village codes:
 * 1. Exact Odia text match
 * 2. English phonetic matching (Soundex/Metaphone)
 * 3. Odia substring/regex match
 * 4. Levenshtein fuzzy match
 * 5. Probe Bhulekh directly via HTTP for each village
 */

import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const BASE_URL = "https://bhulekh.ori.nic.in";
const ROR_VIEW_URL = `${BASE_URL}/RoRView.aspx`;

const PROBE_OUTPUT = '/Users/deekshamohapatra/.claude/projects/-Users-deekshamohapatra-Documents-cleardeed/e3ceb75b-e9de-4ed8-bdd6-8742ca3fc6d5/tool-results/bcz1ic9j7.txt';

// ─── Load full village database from probe output ─────────────────────────────
function loadVillageDB() {
  const content = readFileSync(PROBE_OUTPUT, 'utf-8');
  const tahasil_sections = [...content.matchAll(
    /--- ([^\[]+?) \[(\d+)\] \((\d+) villages\) ---\n(.*?)(?=\n--- |(?:\n={3,}))/gs
  )];

  const db = {}; // tahasilName -> { code, villages: [{code, odia}] }
  for (const [, tah_odia, tah_code, , village_text] of tahasil_sections) {
    const villages = [];
    for (const line of village_text.split('\n')) {
      const m = line.match(/^\s*\[(\d+)\] "([^"]+)"/);
      if (m && m[2] !== "Select Village") {
        villages.push({ code: m[1], odia: m[2] });
      }
    }
    db[tah_odia.trim()] = { code: tah_code, villages };
  }
  return db;
}

// ─── Matching strategies ────────────────────────────────────────────────────────

// Levenshtein distance
function lev(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

// Soundex for English names
function soundex(s) {
  if (!s) return '';
  s = s.toUpperCase().replace(/[^A-Z]/g, '');
  if (s.length === 0) return '';
  const codes = { B:1,F:1,P:1,V:1, C:2,G:2,J:2,K:2,Q:2,S:2,X:2,Z:2, D:3,T:3, L:4,R:4, M:5,N:5, A:6,E:6,I:6,O:6,U:6,H:7,W:7,Y:7 };
  let prev = '', result = s[0];
  for (let i = 1; i < s.length && result.length < 4; i++) {
    const c = codes[s[i]] || '';
    if (c && c !== prev && c !== '6') result += c;
    if (c !== '6') prev = c;
  }
  while (result.length < 4) result += '0';
  return result;
}

// Normalize English name
function normalizeEn(s) {
  return s.toLowerCase().replace(/[^a-z]/g, '').replace(/iya$/, 'ia').replace(/pur$/, 'pur').replace(/nagar$/, 'nagar').replace(/gram$/, 'gram');
}

// All villages we're looking for
const MISSING_VILLAGES = [
  // Bhubaneswar area
  { english: "Sangram", odia_census: "ସଂଗ୍ରାମ", likely_tahasils: ["Bhubaneswar", "Jatni"] },
  { english: "Mandara", odia_census: "ମନ୍ଦର", likely_tahasils: ["Bhubaneswar", "Jatni"] },
  { english: "Gothapada", odia_census: "ଗୋଠପଦା", likely_tahasils: ["Bhubaneswar", "Jatni"] },
  { english: "Bhagabatipur", odia_census: "ଭଗବତୀପୁର", likely_tahasils: ["Bhubaneswar", "Kordha", "Jatni"] },
  { english: "Kudi", odia_census: "କୁଡି", likely_tahasils: ["Bhubaneswar", "Kordha", "Chandaka"] },
  { english: "Dhaulimunda", odia_census: "ଧଉଳୀମୁଣ୍ଡ", likely_tahasils: ["Bhubaneswar", "Kordha", "Begunia"] },
  { english: "Brahmanabilen", odia_census: "ବ୍ରାହ୍ମଣ ବିଲ", likely_tahasils: ["Kordha", "Bhubaneswar", "Begunia"] },
  // Balianta / Balipatna area
  { english: "Balipatna", odia_census: "ବଳିପାଟଣା", likely_tahasils: ["Balipatna", "Balianta", "Begunia"] },
  { english: "Dhaulipur", odia_census: "ଧଉଳୀପୁର", likely_tahasils: ["Balipatna", "Balianta"] },
  { english: "Kakatpur", odia_census: "କାକାଟପୁର", likely_tahasils: ["Balipatna", "Balianta", "Begunia"] },
  { english: "Naikendud", odia_census: "ନାୟକେଣ୍ଡୁଦ", likely_tahasils: ["Balipatna", "Balianta"] },
  // Banapur / Balugaon area
  { english: "Banapur", odia_census: "ବଣପୁର", likely_tahasils: ["Banapur", "Balugaon", "Chilika", "Tangi"] },
  { english: "Khurda", odia_census: "ଖୁର୍ଦ", likely_tahasils: ["Kordha", "Bhubaneswar"] },
  { english: "Gopalpur", odia_census: "ଗୋପାଳପୁର", likely_tahasils: ["Bolgarh", "Begunia", "Bhubaneswar", "Tangi"] },
];

// Odia vowel stripper — extract consonants + nukta for phonetic Odia match
function odiaToKey(s) {
  return s.replace(/[଀-୿]/g, c => {
    const vowels = 'ଅଆଇଈଉଊଋୠଌୡଏଐଓଔଂଃଁ'; // vowels + anusvara + visarga
    if (vowels.includes(c)) return '';
    if (c === '୍') return ''; // virama
    return c;
  }).replace(/\s+/g, '');
}

// ─── Strategy 1: Exact Odia match (census spelling vs Bhulekh spelling) ──────
function strategy1_exactOdia(db, village) {
  const results = [];
  for (const [tahName, tahData] of Object.entries(db)) {
    for (const v of tahData.villages) {
      if (v.odia === village.odia_census) {
        results.push({ ...v, tahasil: tahName, tahasilCode: tahData.code, strategy: 'exact_odia' });
      }
    }
  }
  return results;
}

// ─── Strategy 2: Odia phonetic key match ─────────────────────────────────────
function strategy2_odiaPhonetic(db, village) {
  const key = odiaToKey(village.odia_census);
  const results = [];
  for (const [tahName, tahData] of Object.entries(db)) {
    for (const v of tahData.villages) {
      if (odiaToKey(v.odia) === key) {
        results.push({ ...v, tahasil: tahName, tahasilCode: tahData.code, strategy: 'odia_phonetic' });
      }
    }
  }
  return results;
}

// ─── Strategy 3: Odia substring match (n-gram overlap) ──────────────────────
function strategy3_odiaSubstring(db, village) {
  const results = [];
  const censusKey = odiaToKey(village.odia_census);
  if (censusKey.length < 3) return results;

  for (const [tahName, tahData] of Object.entries(db)) {
    for (const v of tahData.villages) {
      const bhKey = odiaToKey(v.odia);
      if (bhKey.length < 3) continue;
      // Check if key1 is substring of key2 or vice versa
      if (bhKey.includes(censusKey) || censusKey.includes(bhKey)) {
        results.push({ ...v, tahasil: tahName, tahasilCode: tahData.code, strategy: 'odia_substring' });
      }
    }
  }
  return results;
}

// ─── Strategy 4: English Soundex match ──────────────────────────────────────
function strategy4_englishSoundex(db, village) {
  const sdx = soundex(village.english);
  const norm = normalizeEn(village.english);
  const results = [];
  for (const [tahName, tahData] of Object.entries(db)) {
    for (const v of tahData.villages) {
      // Try to match Bhulekh Odia text to English by extracting consonants
      // e.g. "ବ୍ରାହ୍ମଣ" → brah, "ଭଗବତୀ" → bhagavati, etc.
      // This is heuristic — we'll do Levenshtein on romanized Odia
      const romanized = romanizeOdia(v.odia);
      const sdxR = soundex(romanized);
      const normR = normalizeEn(romanized);
      if (sdxR === sdx && sdxR !== '0000' && sdx !== '0000') {
        results.push({ ...v, tahasil: tahName, tahasilCode: tahData.code, strategy: 'soundex', romanized, village_english: village.english });
      }
    }
  }
  return results;
}

// ─── Strategy 5: Levenshtein fuzzy match (all villages) ─────────────────────
function strategy5_levFuzzy(db, village, maxDist = 4) {
  const norm = normalizeEn(village.english);
  const results = [];
  for (const [tahName, tahData] of Object.entries(db)) {
    for (const v of tahData.villages) {
      const romanized = romanizeOdia(v.odia);
      const normR = normalizeEn(romanized);
      const dist = lev(norm, normR);
      if (dist <= maxDist) {
        results.push({ ...v, tahasil: tahName, tahasilCode: tahData.code, strategy: `lev_dist_${dist}`, romanized, village_english: village.english });
      }
    }
  }
  return results;
}

// ─── Strategy 6: Likely tahasil focused search ────────────────────────────────
function strategy6_tahasilFocused(db, village) {
  const results = [];
  const tahasilMap = {
    'Bhubaneswar': ['ଭୁବନେଶ୍ଵର', 'Bhubaneswar'],
    'Jatni': ['ଜଟଣୀ', 'Jatni'],
    'Kordha': ['ଖୋର୍ଦ୍ଧା', 'Kordha', 'Khordha'],
    'Banapur': ['ବାଣପୁର', 'Banapur'],
    'Balipatna': ['ବାଲି ପାଟଣା', 'Balipatna'],
    'Balianta': ['ବାଲିଅନ୍ତା', 'Balianta'],
    'Begunia': ['ବେଗୁନିଆ', 'Begunia'],
    'Bolgarh': ['ବୋଲଗଡ', 'Bolgarh'],
    'Chilika': ['ଚିଲିକା', 'Chilika'],
    'Tangi': ['ଟାଙ୍ଗି', 'Tangi'],
  };

  for (const tahName of village.likely_tahasils) {
    const aliases = tahasilMap[tahName] || [tahName];
    for (const [dbTahName, tahData] of Object.entries(db)) {
      if (aliases.some(a => dbTahName.includes(a) || dbTahName === a)) {
        for (const v of tahData.villages) {
          results.push({ ...v, tahasil: dbTahName, tahasilCode: tahData.code, strategy: `tahasil_focused_${tahName}`, village_english: village.english });
        }
      }
    }
  }
  return results;
}

// ─── Romanize Odia (simplified) ─────────────────────────────────────────────
function romanizeOdia(odia) {
  const map = {
    'ଅ': 'a', 'ଆ': 'aa', 'ଇ': 'i', 'ଈ': 'ii', 'ଉ': 'u', 'ଊ': 'uu',
    'ଋ': 'ri', 'ୠ': 'rii', 'ଌ': 'l', 'ଏ': 'e', 'ଐ': 'ai', 'ଓ': 'o', 'ଔ': 'au',
    'କ': 'k', 'ଖ': 'kh', 'ଗ': 'g', 'ଘ': 'gh', 'ଙ': 'ng',
    'ଚ': 'ch', 'ଛ': 'chh', 'ଜ': 'j', 'ଝ': 'jh', 'ଞ': 'nj',
    'ଟ': 't', 'ଠ': 'th', 'ଡ': 'd', 'ଢ': 'dh', 'ଣ': 'n',
    'ତ': 't', 'ଥ': 'th', 'ଦ': 'd', 'ଧ': 'dh', 'ନ': 'n',
    'ପ': 'p', 'ଫ': 'ph', 'ବ': 'b', 'ଭ': 'bh', 'ମ': 'm',
    'ଯ': 'j', 'ର': 'r', 'ଲ': 'l', 'ଳ': 'l', 'ଶ': 'sh', 'ଷ': 'sh', 'ସ': 's', 'ହ': 'h',
    '଼': 'n', 'ଁ': 'n', 'ଂ': 'ng', 'ଃ': 'h',
    '୍': '', '୦': '0', '୧': '1', '୨': '2', '୩': '3', '୪': '4',
    '୫': '5', '୬': '6', '୭': '7', '୮': '8', '୯': '9',
    'ା': 'aa', 'ି': 'i', 'ୀ': 'ii', 'ୁ': 'u', 'ୂ': 'uu',
    'ୃ': 'ri', 'ୄ': 'rn', 'େ': 'e', 'ୈ': 'ai', 'ୋ': 'o', 'ୌ': 'au',
    '୍': '', 'କ୍ଷ': 'ksha', 'ଜ୍ଞ': 'gya',
  };
  let result = '';
  let i = 0;
  while (i < odia.length) {
    // Check for conjuncts
    const two = odia.slice(i, i+2);
    if (map[two]) { result += map[two]; i += 2; continue; }
    const c = odia[i];
    result += map[c] || c;
    i++;
  }
  return result.replace(/aa/g, 'a').replace(/ii/g, 'i').replace(/uu/g, 'u').replace(/[^a-z]/g, '');
}

// ─── Deduplicate and score results ──────────────────────────────────────────
function dedupAndScore(results) {
  const seen = new Map();
  for (const r of results) {
    const key = `${r.code}-${r.odia}`;
    if (!seen.has(key)) seen.set(key, { ...r, score: 0 });
    seen.get(key).score += getScore(r.strategy);
  }
  return [...seen.values()].sort((a, b) => b.score - a.score);
}

function getScore(strategy) {
  if (strategy === 'exact_odia') return 100;
  if (strategy === 'odia_phonetic') return 80;
  if (strategy === 'odia_substring') return 60;
  if (strategy === 'soundex') return 40;
  if (strategy.startsWith('lev_dist_')) return Math.max(0, 30 - parseInt(strategy.split('_')[2]) * 5);
  if (strategy.startsWith('tahasil_focused')) return 20;
  return 10;
}

// ─── HTTP Bhulekh session helpers ─────────────────────────────────────────────
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
    ...extraFields, "ctl00$ScriptManager1": `ctl00$ContentPlaceHolder1$UpdatePanel1|${eventTarget}`,
    "__EVENTTARGET": eventTarget, "__EVENTARGUMENT": eventArgument,
  });
  const res = await httpRequest(ROR_VIEW_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-microsoftajax": "Delta=true", "x-requested-with": "XMLHttpRequest",
      "Referer": ROR_VIEW_URL, "Cookie": buildCookieHeader() },
    body,
  });
  extractHiddenFields(res.text);
  // Parse delta
  const updateMatch = res.text.match(/updatePanel\|[^|]*\|([\s\S]*?)(?=\|\d+\|hiddenField\||\|\d+\|scriptBlock\||\|asyncPostBackControlIDs\|$)/i);
  return { raw: res.text, updatePanelHtml: updateMatch?.[1] };
}

function extractSelectOptions(html, selectName) {
  const opts = [];
  const match = html.match(new RegExp(`<select[^>]+name=["']${selectName.replace(/\$/g, '\\$')}["'][^>]*>([\\s\\S]*?)</select>`, "gi"));
  if (!match) return opts;
  for (const sel of match) {
    for (const m of sel.matchAll(/<option[^>]+value="([^"]*)"[^>]*>([^<]*)<\/option>/gi))
      opts.push({ value: m[1].trim(), text: m[2].replace(/\s+/g, " ").trim() });
  }
  return opts;
}

// ─── Strategy 7: Direct Bhulekh lookup via HTTP ──────────────────────────────
// Tries each tahasil sequentially to find the village
async function strategy7_directBhulekhLookup(village) {
  const results = [];

  // Bootstrap session
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(ROR_VIEW_URL, { waitUntil: "commit", timeout: 60000 });
  if (page.url().includes("BhulekhError.aspx")) {
    await page.click('a:has-text("here")', { timeout: 10000 });
    await page.waitForTimeout(500);
  }
  await page.waitForSelector("#ctl00_ContentPlaceHolder1_ddlDistrict", { timeout: 15000 });
  const cookies = await page.context().cookies(ROR_VIEW_URL);
  sessionCookies = cookies.map(c => `${c.name}=${c.value}`);
  const hf = await page.evaluate(() => {
    const fields = {};
    document.querySelectorAll('input[type="hidden"]').forEach(el => { fields[el.name] = el.value; });
    return fields;
  });
  hiddenFields = { ...hf };
  await browser.close();

  // Select district 20
  await postAsync("ctl00$ContentPlaceHolder1$ddlDistrict", "", { "ctl00$ContentPlaceHolder1$ddlDistrict": "20" });
  await new Promise(r => setTimeout(r, 500));

  // Get all tahasils
  const fullPage = await httpRequest(ROR_VIEW_URL, { headers: { "Cookie": buildCookieHeader(), "Referer": ROR_VIEW_URL } });
  extractHiddenFields(fullPage.text);
  const allTahasils = extractSelectOptions(fullPage.text, "ddlTahsil");

  // For each tahasil, search for the village
  for (const tah of allTahasils) {
    if (!tah.value) continue;

    // Select this tahasil
    const delta = await postAsync("ctl00$ContentPlaceHolder1$ddlTahsil", "", {
      "ctl00$ContentPlaceHolder1$ddlDistrict": "20",
      "ctl00$ContentPlaceHolder1$ddlTahsil": tah.value,
    });
    await new Promise(r => setTimeout(r, 300));

    // Extract villages
    let villageOpts = [];
    if (delta.updatePanelHtml) villageOpts = extractSelectOptions(delta.updatePanelHtml, "ddlVillage");
    if (villageOpts.length === 0) {
      const full = await httpRequest(ROR_VIEW_URL, { headers: { "Cookie": buildCookieHeader(), "Referer": ROR_VIEW_URL } });
      extractHiddenFields(full.text);
      villageOpts = extractSelectOptions(full.text, "ddlVillage");
    }

    // Look for our village in this tahasil
    const target = village.english.toLowerCase();
    const romanized = romanizeOdia(village.odia_census).toLowerCase();

    for (const v of villageOpts) {
      if (v.value === "Select Village") continue;
      const vLower = v.text.toLowerCase();
      const vRoman = romanizeOdia(v.text).toLowerCase();

      // Try multiple match criteria
      const exact = vLower === target || vRoman === target;
      const contains = vLower.includes(target) || target.includes(vLower);
      const romanContains = vRoman.includes(romanized) || romanized.includes(vRoman);
      const levDist = Math.min(lev(vLower, target), lev(vRoman, target));

      if (exact || contains || romanContains || levDist <= 3) {
        results.push({
          ...v,
          tahasil: tah.text,
          tahasilCode: tah.value,
          strategy: exact ? 'bhulekh_exact' : contains ? 'bhulekh_contains' : romanContains ? 'bhulekh_roman' : `bhulekh_lev${levDist}`,
          levDist,
          village_english: village.english,
          romanized_village: vRoman,
        });
      }
    }
  }

  return results;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const db = loadVillageDB();

  console.log("╔══════════════════════════════════════════════════════════════════════════════╗");
  console.log("║     BHULEKH VILLAGE COMPREHENSIVE MATCH — ALL 13 MISSING VILLAGES           ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════════╝\n");

  for (const village of MISSING_VILLAGES) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`  VILLAGE: ${village.english} (Census Odia: ${village.odia_census})`);
    console.log(`  Likely tahasils: ${village.likely_tahasils.join(', ')}`);
    console.log(`  Romanized: ${romanizeOdia(village.odia_census)}`);
    console.log(`${'═'.repeat(80)}`);

    const allResults = [];

    // Strategy 1: Exact Odia
    const s1 = strategy1_exactOdia(db, village);
    if (s1.length > 0) {
      console.log(`\n  [S1] EXACT ODIA MATCH (score=100):`);
      for (const r of s1)
        console.log(`      [${r.code}] "${r.odia}" (${r.tahasil} [${r.tahasilCode}])`);
      allResults.push(...s1);
    } else {
      console.log(`\n  [S1] Exact Odia: no match`);
    }

    // Strategy 2: Odia phonetic key
    const s2 = strategy2_odiaPhonetic(db, village);
    if (s2.length > 0) {
      console.log(`\n  [S2] ODIA PHONETIC (score=80):`);
      for (const r of s2)
        console.log(`      [${r.code}] "${r.odia}" → ${odiaToKey(r.odia)} (${r.tahasil} [${r.tahasilCode}])`);
      allResults.push(...s2);
    } else {
      console.log(`  [S2] Odia phonetic: no match`);
    }

    // Strategy 3: Odia substring
    const s3 = strategy3_odiaSubstring(db, village);
    if (s3.length > 0) {
      console.log(`\n  [S3] ODIA SUBSTRING (score=60):`);
      for (const r of s3)
        console.log(`      [${r.code}] "${r.odia}" (${r.tahasil} [${r.tahasilCode}])`);
      allResults.push(...s3);
    } else {
      console.log(`  [S3] Odia substring: no match`);
    }

    // Strategy 4: English Soundex
    const s4 = strategy4_englishSoundex(db, village);
    if (s4.length > 0) {
      console.log(`\n  [S4] SOUNDEX (score=40):`);
      for (const r of s4)
        console.log(`      [${r.code}] "${r.odia}" → "${r.romanized}" soundex=${soundex(r.romanized)} (${r.tahasil} [${r.tahasilCode}])`);
      allResults.push(...s4);
    } else {
      console.log(`  [S4] Soundex: no match`);
    }

    // Strategy 5: Levenshtein fuzzy
    const s5 = strategy5_levFuzzy(db, village, 4);
    const uniqueS5 = s5.filter(r => !allResults.some(a => a.code === r.code && a.odia === r.odia));
    if (uniqueS5.length > 0) {
      console.log(`\n  [S5] LEVENSHTEIN (score=30→10):`);
      for (const r of uniqueS5.slice(0, 10))
        console.log(`      [${r.code}] "${r.odia}" → "${r.romanized}" lev=${r.strategy.split('_')[2]} (${r.tahasil} [${r.tahasilCode}])`);
      if (uniqueS5.length > 10) console.log(`      ... and ${uniqueS5.length - 10} more`);
      allResults.push(...uniqueS5);
    } else {
      console.log(`  [S5] Levenshtein: no close match`);
    }

    // Strategy 6: Tahasil focused (print all villages in likely tahasils)
    console.log(`\n  [S6] ALL VILLAGES IN LIKELY TAHAZILS:`);
    for (const tahName of village.likely_tahasils) {
      const tahasilMap = {
        'Bhubaneswar': ['ଭୁବନେଶ୍ଵର'],
        'Jatni': ['ଜଟଣୀ'],
        'Kordha': ['ଖୋର୍ଦ୍ଧା'],
        'Banapur': ['ବାଣପୁର'],
        'Balipatna': ['ବାଲି ପାଟଣା'],
        'Balianta': ['ବାଲିଅନ୍ତା'],
        'Begunia': ['ବେଗୁନିଆ'],
        'Bolgarh': ['ବୋଲଗଡ'],
        'Chilika': ['ଚିଲିକା'],
        'Tangi': ['ଟାଙ୍ଗି'],
      };
      const aliases = tahasilMap[tahName] || [tahName];
      for (const [dbTahName, tahData] of Object.entries(db)) {
        if (aliases.some(a => dbTahName.includes(a))) {
          const matches = [];
          const romTarget = romanizeOdia(village.odia_census).toLowerCase();
          const enTarget = normalizeEn(village.english);
          for (const v of tahData.villages) {
            const romV = romanizeOdia(v.odia).toLowerCase();
            if (romV.includes(romTarget) || romTarget.includes(romV) || lev(romV, romTarget) <= 3) {
              matches.push(`[${v.code}] "${v.odia}" → "${romV}"`);
            }
          }
          if (matches.length > 0) {
            console.log(`    ${dbTahName} [${tahData.code}]:`);
            for (const m of matches) console.log(`      ${m}`);
          } else {
            console.log(`    ${dbTahName} [${tahData.code}]: (no candidates in ${tahData.villages.length} villages)`);
          }
        }
      }
    }

    // Strategy 7: Direct Bhulekh HTTP lookup
    console.log(`\n  [S7] DIRECT BHULEKH LOOKUP (probing all 10 tahasils)...`);
    try {
      const s7 = await strategy7_directBhulekhLookup(village);
      const uniqueS7 = s7.filter(r => !allResults.some(a => a.code === r.code && a.odia === r.odia));
      if (uniqueS7.length > 0) {
        console.log(`      FOUND via direct lookup:`);
        for (const r of uniqueS7)
          console.log(`      [${r.code}] "${r.odia}" → "${r.romanized_village}" (${r.tahasil} [${r.tahasilCode}]) strategy=${r.strategy}`);
        allResults.push(...uniqueS7);
      } else {
        console.log(`      Not found in direct Bhulekh lookup`);
      }
    } catch(e) {
      console.log(`      ERROR in direct lookup: ${e.message}`);
    }

    // Summary
    const scored = dedupAndScore(allResults);
    console.log(`\n  ${'─'.repeat(60)}`);
    console.log(`  SUMMARY for ${village.english}:`);
    if (scored.length > 0) {
      for (const r of scored.slice(0, 5)) {
        console.log(`    ★ [${r.code}] "${r.odia}" (${r.tahasil}) score=${r.score} strategy=${r.strategy}`);
      }
    } else {
      console.log(`    ✗ NOT FOUND in any tahasil`);
    }
    console.log(`  ${'─'.repeat(60)}`);
  }

  // Final summary table
  console.log(`\n\n${'═'.repeat(80)}`);
  console.log(`  FINAL CONFIRMED CODES`);
  console.log(`${'═'.repeat(80)}`);
  console.log(`  Village            | Code | Tahasil     | Odia (Bhulekh)              | Confidence`);
  console.log(`  ${'─'.repeat(76)}`);

  const alreadyConfirmed = {
    'Mendhasala': '105|ଭୁବନେଶ୍ଵର|Bhubaneswar',
    'Chandaka': '76|ଭୁବନେଶ୍ଵର|Bhubaneswar',
    'Haripur': '104|ଭୁବନେଶ୍ଵର|Bhubaneswar',
    'Sijua': '301|ଭୁବନେଶ୍ଵର|Bhubaneswar',
    'Nuagaon': '309|ଭୁବନେଶ୍ଵର|Bhubaneswar',
    'Jatni': '25|ଜଟଣୀ|Jatni',
    'Balugaon': '43|ଚିଲିକା|Chilika',
    'Ranapur': '41|ବାଲିଅନ୍ତା|Balianta',
    'Gopalpur': '84|ବୋଲଗଡ|Bolgarh',
    'Brahmanabilen': '49|ଖୋର୍ଦ୍ଧା|Kordha',
  };

  for (const [name, info] of Object.entries(alreadyConfirmed)) {
    const [code, , tahasil] = info.split('|');
    console.log(`  ${name.padEnd(17)} | ${code.padEnd(4)} | ${tahasil.padEnd(11)} | CONFIRMED`);
  }
  console.log(`\n  Remaining to probe:`);
  for (const v of MISSING_VILLAGES) console.log(`  ✗ ${v.english} (${v.odia_census})`);
}

main().catch(err => {
  console.error("ERROR:", err.message);
  console.error(err.stack);
  process.exit(1);
});
