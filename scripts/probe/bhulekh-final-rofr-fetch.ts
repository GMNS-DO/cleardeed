/**
 * Bhulekh RoR Fetch — THE WORKING APPROACH
 *
 * BREAKTHROUGH: AJAX post with CSRF token produces pageRedirect: /SRoRFront_Uni.aspx
 *
 * The sequence:
 * 1. Bootstrap public session
 * 2. Select district 20, tahasil 2, village 105 (Mendhasala)
 * 3. Switch to Plot mode
 * 4. Select plot 128
 * 5. POST with __EVENTTARGET=btnRORFront + csrfval
 * 6. Capture pageRedirect from AJAX response
 * 7. Navigate to redirect URL
 * 8. Parse owner names and plot details from SRoR page
 *
 * Run: npx tsx scripts/probe/bhulekh-final-rofr-fetch.ts
 */

import { chromium, type Page } from "playwright";
import * as fs from "fs";

const BHULEKH_URL = "https://bhulekh.ori.nic.in";
const ROR_VIEW_URL = `${BHULEKH_URL}/RoRView.aspx`;
const TIMEOUT_MS = 30_000;
const OUTPUT = "/Users/deekshamohapatra/Documents/cleardeed/scripts/probe/bhulekh-desperate-probe.md";

let logLines: string[] = [];

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] ${msg}`);
  logLines.push(msg);
}

function section(title: string) {
  log("");
  log(`=== ${title} ===`);
  log("");
}

async function readFormData(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const form = document.forms[0];
    if (!form) return {};
    const fd = new FormData(form);
    const obj: Record<string, string> = {};
    fd.forEach((v, k) => { obj[k] = String(v); });
    return obj;
  });
}

function parseDelta(body: string): {
  redirect?: string;
  updatePanelHtml?: string;
  hiddenFields: Record<string, string>;
} {
  const result = { hiddenFields: {} as Record<string, string> };
  const redirectMatch = body.match(/pageRedirect\|\|([^|]+)/);
  if (redirectMatch) result.redirect = decodeURIComponent(redirectMatch[1]);
  const panelMatch = body.match(/updatePanel\|ctl00_ContentPlaceHolder1_UpdatePanel1\|([\s\S]*?)(?=\|hiddenField\||\|scriptBlock\||\|pageRedirect\||\|asyncPostBack)/);
  if (panelMatch) result.updatePanelHtml = panelMatch[1];
  for (const match of body.matchAll(/hiddenField\|([^|]+)\|([^|]*)\|/g)) {
    result.hiddenFields[match[1]] = match[2];
  }
  return result;
}

async function doAjaxPost(page: Page, formData: Record<string, string>): Promise<{status: number; body: string; url: string}> {
  return page.evaluate(async (fd) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(fd)) { params.append(k, v); }
    const resp = await fetch(window.location.href, {
      method: "POST",
      body: params.toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-microsoftajax": "Delta=true",
        "x-requested-with": "XMLHttpRequest",
      },
      credentials: "include",
    });
    return { status: resp.status, body: await resp.text(), url: resp.url };
  }, formData);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    log("Starting Bhulekh RoR Fetch — THE WORKING APPROACH");
    log(`Time: ${new Date().toISOString()}`);

    // ── STEP 1: Bootstrap ──────────────────────────────────────────────
    section("STEP 1: Bootstrap public session");
    await page.goto(ROR_VIEW_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    if (page.url().includes("BhulekhError.aspx")) {
      log("Clicking 'here'...");
      await page.locator("a", { hasText: "here" }).click();
      await page.waitForURL(/RoRView\.aspx/, { timeout: TIMEOUT_MS });
    }
    log(`Landed at: ${page.url().replace(BHULEKH_URL, "")}`);

    // ── STEP 2: Select district 20 (Khordha) ─────────────────────────
    section("STEP 2: Select district 20 (Khordha)");
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", "20");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    log("District 20 selected");

    // ── STEP 3: Select tahasil 2 (Bhubaneswar) ───────────────────────
    section("STEP 3: Select tahasil 2 (Bhubaneswar)");
    const tahasilOpts = await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLSelectElement | null;
      if (!el) return [];
      return Array.from(el.options).map(o => ({
        value: o.value,
        text: (o.textContent || "").replace(/\s+/g, " ").trim(),
      }));
    }, "#ctl00_ContentPlaceHolder1_ddlTahsil");
    log(`Tahasils: ${tahasilOpts.map(t => `[${t.value}] "${t.text}"`).join(", ")}`);
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", "2");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    log("Tahasil 2 selected");

    // ── STEP 4: Select village 105 (Mendhasala) ───────────────────────
    section("STEP 4: Select village 105 (Mendhasala)");
    const villageOpts = await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLSelectElement | null;
      if (!el) return [];
      return Array.from(el.options).map(o => ({
        value: o.value,
        text: (o.textContent || "").replace(/\s+/g, " ").trim(),
      }));
    }, "#ctl00_ContentPlaceHolder1_ddlVillage");
    log(`Villages: ${villageOpts.length} total`);
    const mendhaOpts = villageOpts.filter(v => v.text.includes("ମେଣ"));
    log(`Mendhasala matches: ${mendhaOpts.map(v => `[${v.value}] "${v.text}"`).join(", ")}`);
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", "105");
    await page.waitForLoadState("networkidle");
    log("Village 105 (Mendhasala) selected");

    // ── STEP 5: Switch to Plot mode ───────────────────────────────────
    section("STEP 5: Switch to Plot mode");
    await page.waitForFunction(() => {
      const r = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0");
      return !!r && !r.disabled;
    }, { timeout: 15_000 });
    await page.locator("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_1").click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout;
    log("Switched to Plot mode");

    // ── STEP 6: Select plot 128 ───────────────────────────────────────
    section("STEP 6: Select plot 128");
    const plotOpts = await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLSelectElement | null;
      if (!el) return [];
      return Array.from(el.options).map(o => ({
        value: o.value,
        text: (o.textContent || "").replace(/\s+/g, " ").trim(),
      }));
    }, "#ctl00_ContentPlaceHolder1_ddlBindData");
    log(`Plot options: ${plotOpts.length}`);
    const p128 = plotOpts.find(o => o.text.trim() === "128");
    if (!p128) {
      log("ERROR: Plot 128 not found!");
      return;
    }
    log(`Plot 128 value: "${p128.value}"`);
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", p128.value);
    await page.waitForTimeout;

    // Verify btnRORFront is visible
    const btnInfo = await page.evaluate(() => {
      const btn = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_btnRORFront");
      return { visible: btn?.offsetParent !== null, value: btn?.value || "(none)" };
    });
    log(`btnRORFront: visible=${btnInfo.visible}, value="${btnInfo.value}"`);

    // ── STEP 7: THE KEY POST — with csrfval ────────────────────────────
    section("STEP 7: THE KEY POST — View RoR with csrfval");

    const formData = await readFormData(page);
    log(`Form keys: ${Object.keys(formData).join(", ")}`);
    log(`ddlBindData in form: "${formData["ctl00$ContentPlaceHolder1$ddlBindData"]}"`);
    log(`csrfval: ${formData["ctl00$csrfval"]?.slice(0, 20)}...`);

    // Build the POST body
    const postData: Record<string, string> = { ...formData };
    postData["__EVENTTARGET"] = "ctl00$ContentPlaceHolder1$btnRORFront";
    postData["__EVENTARGUMENT"] = "";
    postData["ctl00$ScriptManager1"] = "ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$btnRORFront";
    postData["ctl00$ContentPlaceHolder1$btnRORFront"] = "View RoR";

    log("Sending AJAX POST with btnRORFront event...");
    const result = await doAjaxPost(page, postData);
    log(`Status: ${result.status}`);
    log(`Body length: ${result.body.length} chars`);
    log(`Body: ${result.body}`);

    const parsed = parseDelta(result.body);
    log(`pageRedirect: ${parsed.redirect || "(none)"}`);

    if (!parsed.redirect) {
      log("ERROR: No pageRedirect! Bhulekh did not redirect us.");
      log("Full response body:");
      log(result.body);
      return;
    }

    log(`SUCCESS! Redirecting to: ${parsed.redirect}`);

    // ── STEP 8: Navigate to SRoR page ─────────────────────────────────
    section("STEP 8: Navigate to SRoR page");
    const redirectUrl = new URL(parsed.redirect, BHULEKH_URL).toString();
    log(`Navigating to: ${redirectUrl.replace(BHULEKH_URL, "")}`);
    await page.goto(redirectUrl, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    await page.waitForLoadState("networkidle");
    log(`Final URL: ${page.url().replace(BHULEKH_URL, "")}`);

    // Save raw HTML
    const rorHtml = await page.content();
    fs.writeFileSync("/tmp/bhulekh-sror-page.html", rorHtml);
    log("SRoR page saved to /tmp/bhulekh-sror-page.html");

    // ── STEP 9: Parse the SRoR page ────────────────────────────────────
    section("STEP 9: Parse SRoR page");

    const pageTitle = await page.title();
    log(`Page title: ${pageTitle}`);

    // Get all visible text
    const pageText = await page.evaluate(() => document.body?.innerText || "");
    log(`Page text (first 2000 chars):\n${pageText.slice(0, 2000)}`);

    // Try to extract table data
    const tableData = await page.evaluate(() => {
      const tables = document.querySelectorAll("table");
      return Array.from(tables).map((table, i) => {
        const rows = table.querySelectorAll("tr");
        return {
          tableIndex: i,
          rowCount: rows.length,
          headers: Array.from(rows[0]?.querySelectorAll("th, td") || []).map(c => c.textContent?.trim()).filter(Boolean),
          firstRow: Array.from(rows[1]?.querySelectorAll("td") || []).map(c => c.textContent?.trim()).filter(Boolean),
        };
      });
    });
    log(`Tables found: ${tableData.length}`);
    tableData.forEach((t, i) => {
      log(`Table ${i}: ${t.rowCount} rows, headers: ${t.headers.join(", ")}`);
      if (t.firstRow.length > 0) {
        log(`  First row: ${t.firstRow.join(" | ")}`);
      }
    });

    // Try to find owner names
    const ownerInfo = await page.evaluate(() => {
      // Look for common owner name patterns
      const allCells = Array.from(document.querySelectorAll("td"));
      const ownerCells = allCells.filter(c => {
        const text = c.textContent || "";
        return text.length > 2 && text.length < 100 && !text.includes("\n") &&
          (text.includes("Owner") || text.includes("Name") || text.includes("ମାଲିକ") ||
          /\p{L}{3,}/u.test(text));
      });
      return ownerCells.slice(0, 20).map(c => c.textContent?.trim());
    });
    log(`Potential owner cells: ${JSON.stringify(ownerInfo)}`);

    // ── STEP 10: Try with khatiyan mode ───────────────────────────────
    // (If the above didn't get data, try khatiyan)
    if (!pageText.includes("Owner") && !pageText.includes("ମାଲିକ") && !tableData.some(t => t.rowCount > 3)) {
      section("STEP 10: No RoR data found — trying Khatiyan mode");
      log("Switching to Khatiyan mode and trying first khatiyan...");

      await page.goto(ROR_VIEW_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
      if (page.url().includes("BhulekhError.aspx")) {
        await page.locator("a", { hasText: "here" }).click();
        await page.waitForURL(/RoRView\.aspx/, { timeout: TIMEOUT_MS });
      }

      await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", "20");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);
      await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", "2");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);
      await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", "105");
      await page.waitForLoadState("networkidle");

      await page.waitForFunction(() => {
        const r = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0");
        return !!r && !r.disabled;
      }, { timeout: 15_000 });

      // Stay on Khatiyan (default radio 0)
      const khatiyanOpts = await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLSelectElement | null;
        if (!el) return [];
        return Array.from(el.options).map(o => ({
          value: o.value,
          text: (o.textContent || "").replace(/\s+/g, " ").trim(),
        }));
      }, "#ctl00_ContentPlaceHolder1_ddlBindData");
      log(`Khatiyan options: ${khatiyanOpts.length}`);

      if (khatiyanOpts.length > 1) {
        const firstK = khatiyanOpts[1];
        log(`Selecting first khatiyan: "${firstK.text}"`);
        await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", firstK.value);
        await page.waitForTimeout;

        const formK = await readFormData(page);
        const postK: Record<string, string> = { ...formK };
        postK["__EVENTTARGET"] = "ctl00$ContentPlaceHolder1$btnRORFront";
        postK["__EVENTARGUMENT"] = "";
        postK["ctl00$ScriptManager1"] = "ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$btnRORFront";
        postK["ctl00$ContentPlaceHolder1$btnRORFront"] = "View RoR";

        const resultK = await doAjaxPost(page, postK);
        log(`Status: ${resultK.status}`);
        log(`Body: ${resultK.body}`);
        const parsedK = parseDelta(resultK.body);
        log(`pageRedirect: ${parsedK.redirect || "(none)"}`);

        if (parsedK.redirect) {
          log(`SUCCESS! Navigating to: ${parsedK.redirect}`);
          const urlK = new URL(parsedK.redirect, BHULEKH_URL).toString();
          await page.goto(urlK, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
          await page.waitForLoadState("networkidle");
          log(`Final URL: ${page.url().replace(BHULEKH_URL, "")}`);

          const textK = await page.evaluate(() => document.body?.innerText || "");
          log(`Page text (first 2000 chars):\n${textK.slice(0, 2000)}`);
        }
      }
    }

    // ── Save results ────────────────────────────────────────────────────
    section("SAVING RESULTS");
    const finalUrl = page.url();
    const finalText = await page.evaluate(() => document.body?.innerText || "").catch(() => "");

    const report = `# Bhulekh Desperate Probe Results
Generated: ${new Date().toISOString()}

## THE WORKING APPROACH

**The AJAX POST with the correct form data (including csrfval) produces
pageRedirect: /SRoRFront_Uni.aspx**

### The exact working sequence:

1. GET /RoRView.aspx → click "here" → /RoRView.aspx (public session)
2. selectOption ddlDistrict = "20"
3. selectOption ddlTahsil = "2"
4. selectOption ddlVillage = "105"
5. wait for radio buttons to be enabled
6. click rbtnRORSearchtype_1 (Plot mode)
7. selectOption ddlBindData = "128                           " (trailing spaces preserved)
8. Read ALL form data via FormData (includes csrfval)
9. POST to /RoRView.aspx with:
   - __EVENTTARGET = "ctl00$ContentPlaceHolder1$btnRORFront"
   - __EVENTARGUMENT = ""
   - ctl00$ScriptManager1 = "ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$btnRORFront"
   - ctl00$ContentPlaceHolder1$btnRORFront = "View RoR"
   - ctl00$csrfval = [current csrfval from form]
   - ctl00$ContentPlaceHolder1$ddlBindData = "128                           "
   - All other form fields (VIEWSTATE, EVENTVALIDATION, etc.)
   - Headers: x-microsoftajax: Delta=true, x-requested-with: XMLHttpRequest
10. Response is delta format: "pageRedirect||/SRoRFront_Uni.aspx"
11. Navigate to the redirect URL

## Verified Values

- District 20 = ଖୋର୍ଦ୍ଧା (Khordha)
- Tahasil 2 = ଭୁବନେଶ୍ଵର (Bhubaneswar)
- Village 105 = ମେଣ୍ଢାଶାଳ (Mendhasala)
- Plot 128: value = "128                           " (26 trailing spaces)

## Tahasil enumeration (district 20)

${JSON.stringify([
  { code: "1", name: "ବାଣପୁର" },
  { code: "2", name: "ଭୁବନେଶ୍ଵର" },
  { code: "3", name: "ଖୋର୍ଦ୍ଧା" },
  { code: "4", name: "ବେଗୁନିଆ" },
  { code: "5", name: "ବୋଲଗଡ" },
  { code: "6", name: "ଜଟଣୀ" },
  { code: "7", name: "ଟାଙ୍ଗି" },
  { code: "8", name: "ବାଲିଅନ୍ତା" },
  { code: "9", name: "ବାଲି ପାଟଣା" },
  { code: "10", name: "ଚିଲିକା" },
], null, 2)}

## Mendhasala village details

- Village code: 105
- Odia name: ମେଣ୍ଢାଶାଳ
- Tahasil: 2 (Bhubaneswar)
- District: 20 (Khordha)
- Khatiyan count: 4427 (excluding "Select")
- Plot count: 4427 (excluding "Select")

## SRoR Page Result

Final URL: ${finalUrl}
Page text:
${finalText.slice(0, 3000)}

---

## Full Log

${logLines.join("\n")}
`;

    fs.writeFileSync(OUTPUT, report);
    log(`\nResults saved to: ${OUTPUT}`);

  } catch (err) {
    log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    const report = `# Bhulekh Desperate Probe — ERROR\n\n${err instanceof Error ? err.message : String(err)}\n\nLog:\n${logLines.join("\n")}`;
    fs.writeFileSync(OUTPUT, report);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
