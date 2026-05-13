#!/usr/bin/env node
/**
 * Bhulekh probe DEBUG — check what's happening with the district→tahasil cascade.
 */
import { chromium } from "playwright";

const ROR_VIEW_URL = "https://bhulekh.ori.nic.in/RoRView.aspx";

let cookies = [];
let hiddenFields = {};

async function fetch(url, init = {}) {
  const mergedHeaders = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": (init.headers && init.headers["x-microsoftajax"]) ? "*/*" : "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
  };
  if (init.headers) {
    for (const [k, v] of Object.entries(init.headers)) mergedHeaders[k] = v;
  }
  const response = await globalThis.fetch(url, {
    method: init.method ?? "GET",
    headers: mergedHeaders,
    credentials: "omit",
    body: init.body,
  });
  const setCookie = response.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const [nameVal] = c.split(";");
    if (nameVal && !cookies.includes(nameVal)) cookies.push(nameVal);
  }
  return { status: response.status, text: await response.text(), headers: response.headers };
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
  for (const m of html.matchAll(/<input[^>]+type="hidden"[^>]+>/gi)) {
    const nm = m[0].match(/name="([^"]+)"/);
    const vl = m[0].match(/value="([^"]*)"/);
    if (nm) hiddenFields[nm[1]] = vl?.[1] ?? "";
  }
  for (const m of html.matchAll(/hiddenField\|([^|]+)\|([^|]*)\|/g)) {
    hiddenFields[m[1]] = m[2];
  }
}

async function postAsync(eventTarget, eventArgument = "", extraFields = {}) {
  const scriptManager = `ctl00$ContentPlaceHolder1$UpdatePanel1|${eventTarget}`;
  const body = buildFormBody({
    ...extraFields,
    "ctl00$ScriptManager1": scriptManager,
    "__EVENTTARGET": eventTarget,
    "__EVENTARGUMENT": eventArgument,
  });

  const res = await fetch(ROR_VIEW_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-microsoftajax": "Delta=true",
      "x-requested-with": "XMLHttpRequest",
      "Referer": ROR_VIEW_URL,
      "Cookie": cookies.join("; "),
    },
    body,
  });

  extractHiddenFields(res.text);

  const updatePanelMatch = res.text.match(
    /updatePanel\|[^|]*\|([\s\S]*?)(?=\|\d+\|hiddenField\||\|\d+\|scriptBlock\||\|asyncPostBackControlIDs\|$)/i
  );

  return { raw: res.text, updatePanelHtml: updatePanelMatch?.[1] };
}

function extractSelectOptions(html, selectName) {
  const opts = [];
  const match = html.match(
    new RegExp(`<select[^>]+name=["']${selectName.replace(/\$/g, "\\$")}["'][^>]*>([\\s\\S]*?)</select>`, "gi")
  );
  if (!match) return opts;
  for (const sel of match) {
    for (const m of sel.matchAll(/<option[^>]+value="([^"]*)"[^>]*>([^<]*)<\/option>/gi)) {
      opts.push({ value: m[1].trim(), text: m[2].replace(/\s+/g, " ").trim() });
    }
  }
  return opts;
}

async function main() {
  console.log("=== Bhulekh Debug ===\n");

  // Get session via browser
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(ROR_VIEW_URL, { waitUntil: "commit", timeout: 30000 });
      break;
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  if (page.url().includes("BhulekhError")) {
    console.log("On error page — clicking 'here'...");
    try {
      await page.locator('a', { hasText: /here/i }).first().click({ timeout: 8000 });
      await page.waitForTimeout;
    } catch (e) { /* continue */ }
  }

  try {
    await page.waitForSelector("#ctl00_ContentPlaceHolder1_ddlDistrict", { timeout: 10000 });
  } catch (e) {}

  const pageCookies = await page.context().cookies(ROR_VIEW_URL).catch(() => []);
  cookies = pageCookies.map(c => `${c.name}=${c.value}`);
  console.log(`Cookies: ${cookies.length}`);

  hiddenFields = await page.evaluate(() => {
    const fields = {};
    document.querySelectorAll('input[type="hidden"]').forEach(el => { fields[el.name] = el.value; });
    return fields;
  }).catch(() => ({}));
  console.log(`Hidden fields: ${Object.keys(hiddenFields).length}, VS: ${(hiddenFields['__VIEWSTATE']||'').length} chars`);

  // Check initial state
  const initContent = await page.content();
  console.log(`\nInitial page URL: ${page.url()}`);
  const initTahOpts = extractSelectOptions(initContent, "ctl00$ContentPlaceHolder1$ddlTahsil");
  console.log(`Initial tahasil options: ${initTahOpts.length}`);
  const initDistOpts = extractSelectOptions(initContent, "ctl00$ContentPlaceHolder1$ddlDistrict");
  console.log(`Initial district options: ${initDistOpts.length}`);

  // Check hidden fields being sent
  console.log(`\nFields in hiddenFields: ${Object.keys(hiddenFields).join(', ')}`);

  // Try HTTP POST to select district
  console.log("\n--- HTTP POST to select district 20 ---");
  console.log(`Sending: ddlDistrict=20, ddlTahsil=(empty), ddlVillage=(empty)`);

  const delta = await postAsync(
    "ctl00$ContentPlaceHolder1$ddlDistrict", "",
    {
      "ctl00$ContentPlaceHolder1$ddlDistrict": "20",
      "ctl00$ContentPlaceHolder1$ddlTahsil": "",
      "ctl00$ContentPlaceHolder1$ddlVillage": "",
    }
  );

  console.log(`\nDelta raw length: ${delta.raw.length}`);
  console.log(`Update panel HTML length: ${(delta.updatePanelHtml||'').length}`);

  // Check what's in the update panel
  if (delta.updatePanelHtml) {
    const upTahOpts = extractSelectOptions(delta.updatePanelHtml, "ddlTahsil");
    const upDistOpts = extractSelectOptions(delta.updatePanelHtml, "ddlDistrict");
    console.log(`\nIn update panel:`);
    console.log(`  District options: ${upDistOpts.length}`);
    console.log(`  Tahasil options: ${upTahOpts.length}`);
    for (const o of upTahOpts.slice(0, 10)) {
      console.log(`    [${o.value}] "${o.text}"`);
    }
  } else {
    console.log(`\nNo update panel HTML in delta!`);
    console.log(`Raw response preview: ${delta.raw.substring(0, 500)}`);
  }

  // Try fetching the full page
  const full = await fetch(ROR_VIEW_URL, {
    headers: { "Cookie": cookies.join("; "), "Referer": ROR_VIEW_URL }
  });
  console.log(`\nFull page after district select: ${full.text.length} bytes`);
  const fullTahOpts = extractSelectOptions(full.text, "ctl00$ContentPlaceHolder1$ddlTahsil");
  console.log(`Full page tahasil options: ${fullTahOpts.length}`);
  for (const o of fullTahOpts.slice(0, 10)) {
    console.log(`  [${o.value}] "${o.text}"`);
  }

  await browser.close();
}

main().catch(e => {
  console.error("ERROR:", e.message.split('\n')[0]);
  process.exit(1);
});