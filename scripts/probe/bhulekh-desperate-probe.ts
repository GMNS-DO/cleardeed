/**
 * Bhulekh Desperate Probe — Comprehensive enumeration and multiple trigger approaches
 *
 * Objective: Find working RoR data for Mendhasala village, Khordha district.
 *
 * Run: npx tsx scripts/probe/bhulekh-desperate-probe.ts
 *
 * This script tries:
 * 1. Enumerate ALL options at every dropdown level
 * 2. Find villages containing "mendhasala" or "chandaka" Odia text
 * 3. Try all tahasils for district=20
 * 4. Enumerate ALL plot options (not just first 10)
 * 5. Multiple View RoR trigger approaches
 * 6. Save everything to scripts/probe/bhulekh-desperate-probe.md
 */

import { chromium, type Page, type Request } from "playwright";
import * as fs from "fs";

const BHULEKH_URL = "https://bhulekh.ori.nic.in";
const ROR_VIEW_URL = `${BHULEKH_URL}/RoRView.aspx`;
const TIMEOUT_MS = 30_000;
const PROBE_OUTPUT = "/Users/deekshamohapatra/Documents/cleardeed/scripts/probe/bhulekh-desperate-probe.md";

interface DropdownOption {
  value: string;
  text: string;
}

let logLines: string[] = [];

function log(msg: string) {
  const timestamp = new Date().toISOString().slice(11, 23);
  console.log(`[${timestamp}] ${msg}`);
  logLines.push(msg);
}

function section(title: string) {
  log("");
  log(`=== ${title} ===`);
  log("");
}

async function readAllOptions(page: Page, selector: string): Promise<DropdownOption[]> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLSelectElement | null;
    if (!el) return [];
    return Array.from(el.options).map((o) => ({
      value: o.value,
      text: (o.textContent || "").replace(/\s+/g, " ").trim(),
    }));
  }, selector);
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

async function buildPostBody(page: Page, overrides: Record<string, string> = {}): Promise<string> {
  const fd = await readFormData(page);
  Object.assign(fd, overrides);
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(fd)) {
    params.append(k, v);
  }
  return params.toString();
}

async function doAjaxPost(page: Page, body: string, label: string): Promise<{ status: number; body: string; url: string }> {
  log(`  ${label} — POST ${page.url().replace(BHULEKH_URL, "")}`);
  return page.evaluate(async (b) => {
    const resp = await fetch(window.location.href, {
      method: "POST",
      body: b,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-microsoftajax": "Delta=true",
        "x-requested-with": "XMLHttpRequest",
      },
      credentials: "include",
    });
    return { status: resp.status, body: await resp.text(), url: resp.url };
  }, body);
}

async function doFullPost(page: Page, body: string, label: string): Promise<{ status: number; body: string; url: string }> {
  log(`  ${label} — FULL POST ${page.url().replace(BHULEKH_URL, "")}`);
  return page.evaluate(async (b) => {
    const resp = await fetch(window.location.href, {
      method: "POST",
      body: b,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      credentials: "include",
    });
    return { status: resp.status, body: await resp.text(), url: resp.url };
  }, body);
}

function parseDeltaResponse(body: string): {
  redirect?: string;
  updatePanelHtml?: string;
  hiddenFields: Record<string, string>;
  hasError?: string;
} {
  const result: ReturnType<typeof parseDeltaResponse> = { hiddenFields: {} };

  // pageRedirect
  const redirectMatch = body.match(/pageRedirect\|\|([^|]+)/);
  if (redirectMatch) {
    result.redirect = decodeURIComponent(redirectMatch[1]);
  }

  // updatePanel
  const panelMatch = body.match(/updatePanel\|ctl00_ContentPlaceHolder1_UpdatePanel1\|([\s\S]*?)(?=\|hiddenField\||\|scriptBlock\||\|pageRedirect\||\|asyncPostBackControl)/);
  if (panelMatch) {
    result.updatePanelHtml = panelMatch[1];
  }

  // hidden fields
  for (const match of body.matchAll(/hiddenField\|([^|]+)\|([^|]*)\|/g)) {
    result.hiddenFields[match[1]] = match[2];
  }

  // error
  const errorMatch = body.match(/error\|([^\|]+)/);
  if (errorMatch) {
    result.hasError = errorMatch[1];
  }

  return result;
}

function findOdiaMatches(options: DropdownOption[], patterns: string[]): DropdownOption[] {
  return options.filter((o) =>
    patterns.some((p) => o.text.includes(p) || o.value.includes(p))
  );
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const allRequests: Request[] = [];
  page.on("request", (req) => {
    if (req.url().includes("bhulekh")) allRequests.push(req);
  });

  try {
    log("Starting Bhulekh Desperate Probe");
    log(`Time: ${new Date().toISOString()}`);

    // ── STEP 1: Bootstrap ────────────────────────────────────────────────
    section("STEP 1: Bootstrap public session");
    await page.goto(ROR_VIEW_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    log(`Initial URL: ${page.url().replace(BHULEKH_URL, "")}`);

    if (page.url().includes("BhulekhError.aspx")) {
      log("Redirected to BhulekhError.aspx — clicking 'here'...");
      await page.locator("a", { hasText: "here" }).click();
      await page.waitForURL(/RoRView\.aspx/, { timeout: TIMEOUT_MS });
    }
    log(`Final URL after bootstrap: ${page.url().replace(BHULEKH_URL, "")}`);

    // ── STEP 2: Enumerate districts ─────────────────────────────────────
    section("STEP 2: District options");
    const districts = await readAllOptions(page, "#ctl00_ContentPlaceHolder1_ddlDistrict");
    log(`Found ${districts.length} district options:`);
    districts.forEach((d) => {
      const marker = d.value === "20" ? " <-- Khordha" : "";
      log(`  [${d.value}] "${d.text}"${marker}`);
    });

    // ── STEP 3: Enumerate tahasils for district 20 ─────────────────────
    section("STEP 3: Tahasil options for district=20");
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", "20");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    const tahasils = await readAllOptions(page, "#ctl00_ContentPlaceHolder1_ddlTahsil");
    log(`Found ${tahasils.length} tahasil options for district 20:`);
    tahasils.forEach((t) => {
      const marker = t.value === "2" ? " <-- Bhubaneswar" : "";
      log(`  [${t.value}] "${t.text}"${marker}`);
    });

    // ── STEP 4: Enumerate ALL villages for Bhubaneswar tahasil ─────────
    section("STEP 4: Village options for district=20, tahasil=2 (Bhubaneswar)");
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", "2");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout;

    const villages = await readAllOptions(page, "#ctl00_ContentPlaceHolder1_ddlVillage");
    log(`Found ${villages.length} village options:`);

    // Search for mendhasala/chandaka patterns
    const mendhasalaMatches = findOdiaMatches(villages, ["ମେଣ", "mendha", "mendasala"]);
    const chandakaMatches = findOdiaMatches(villages, ["ଚଣ୍ଡ", "chandaka"]);
    const mendhasalMatch = villages.filter((v) =>
      v.text.replace(/\s+/g, " ").toLowerCase().includes("mendhasala")
    );
    const chandakaMatch = villages.filter((v) =>
      v.text.replace(/\s+/g, " ").toLowerCase().includes("chandaka")
    );

    log("");
    log("Mendhasala Odia matches:");
    mendhasalaMatches.forEach((v) => log(`  [${v.value}] "${v.text}"`));
    log("Chandaka Odia matches:");
    chandakaMatches.forEach((v) => log(`  [${v.value}] "${v.text}"`));
    log("Mendhasala English matches:");
    mendhasalMatch.forEach((v) => log(`  [${v.value}] "${v.text}"`));
    log("Chandaka English matches:");
    chandakaMatch.forEach((v) => log(`  [${v.value}] "${v.text}"`));

    log("");
    log("All villages (first 50):");
    villages.slice(0, 50).forEach((v) => log(`  [${v.value}] "${v.text}"`));
    if (villages.length > 50) {
      log(`  ... and ${villages.length - 50} more`);
    }

    // Find the village matching code 105 (Mendhasala) and code 2 (Chandaka)
    const village105 = villages.find((v) => v.value === "105");
    const village2 = villages.find((v) => v.value === "2");
    log("");
    log(`Village code 105: ${village105 ? `"${village105.text}"` : "NOT FOUND"}`);
    log(`Village code 2: ${village2 ? `"${village2.text}"` : "NOT FOUND"}`);

    // ── STEP 5: Enumerate villages WITHOUT tahasil selection ────────────
    section("STEP 5: Village options for district=20 with NO tahasil selected");
    // Go back and don't select tahasil
    await page.goto(ROR_VIEW_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    if (page.url().includes("BhulekhError.aspx")) {
      await page.locator("a", { hasText: "here" }).click();
      await page.waitForURL(/RoRView\.aspx/, { timeout: TIMEOUT_MS });
    }
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", "20");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    const villagesNoTahasil = await readAllOptions(page, "#ctl00_ContentPlaceHolder1_ddlVillage");
    log(`Found ${villagesNoTahasil.length} village options WITHOUT tahasil selection:`);
    const mendhaNoTahasil = findOdiaMatches(villagesNoTahasil, ["ମେଣ", "mendha"]);
    mendhaNoTahasil.forEach((v) => log(`  [${v.value}] "${v.text}"`));
    log("First 20 villages:");
    villagesNoTahasil.slice(0, 20).forEach((v) => log(`  [${v.value}] "${v.text}"`));

    // ── STEP 6: Try ALL tahasils for district 20 and find villages ──────
    section("STEP 6: Enumerate villages for ALL tahasils of district 20");
    await page.goto(ROR_VIEW_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    if (page.url().includes("BhulekhError.aspx")) {
      await page.locator("a", { hasText: "here" }).click();
      await page.waitForURL(/RoRView\.aspx/, { timeout: TIMEOUT_MS });
    }
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", "20");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    const allTahasils = await readAllOptions(page, "#ctl00_ContentPlaceHolder1_ddlTahsil");
    const tahasilVillageCounts: Record<string, number> = {};
    const allVillageMappings: Record<string, DropdownOption[]> = {};

    for (const tahasil of allTahasils.slice(1)) { // skip "Select"
      await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", tahasil.value);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);
      const vills = await readAllOptions(page, "#ctl00_ContentPlaceHolder1_ddlVillage");
      tahasilVillageCounts[tahasil.value] = vills.length;
      allVillageMappings[tahasil.value] = vills;

      const mendhaInTahasil = findOdiaMatches(vills, ["ମେଣ", "mendha"]);
      const chandaInTahasil = findOdiaMatches(vills, ["ଚଣ୍ଡ", "chanda"]);
      if (mendhaInTahasil.length > 0 || chandaInTahasil.length > 0) {
        log(`TAHASIL ${tahasil.value} (${tahasil.text}) has potential matches!`);
        mendhaInTahasil.forEach((v) => log(`  MENDHA: [${v.value}] "${v.text}"`));
        chandaInTahasil.forEach((v) => log(`  CHANDAKA: [${v.value}] "${v.text}"`));
      }
    }

    log("");
    log("Village count per tahasil:");
    for (const [tVal, count] of Object.entries(tahasilVillageCounts)) {
      const tName = allTahasils.find((t) => t.value === tVal)?.text || tVal;
      log(`  Tahasil ${tVal} (${tName}): ${count} villages`);
    }

    // ── STEP 7: Select Mendhasala and enumerate plots ─────────────────────
    section("STEP 7: Mendhasala — switch to Plot mode, enumerate ALL plots");

    // Use the confirmed village code 105
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", "2");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", "105");
    await page.waitForLoadState("networkidle");

    // Wait for radio buttons to be enabled
    await page.waitForFunction(() => {
      const radio = document.querySelector<HTMLInputElement>(
        "#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0"
      );
      return !!radio && !radio.disabled;
    }, { timeout: 15_000 });

    log("Village 105 selected — checking radio buttons...");
    const radio0 = await page.locator("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0").isVisible();
    const radio1 = await page.locator("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_1").isVisible();
    log(`Radio 0 (Khatiyan) visible: ${radio0}`);
    log(`Radio 1 (Plot) visible: ${radio1}`);

    // Check Khatiyan options first
    const khatiyanOptions = await readAllOptions(page, "#ctl00_ContentPlaceHolder1_ddlBindData");
    log(`Khatiyan dropdown has ${khatiyanOptions.length} options:`);
    khatiyanOptions.slice(0, 10).forEach((o) => log(`  [${o.value}] "${o.text}"`));

    // Switch to Plot mode
    log("");
    log("Switching to Plot mode...");
    await page.locator("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_1").click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout;

    const plotOptions = await readAllOptions(page, "#ctl00_ContentPlaceHolder1_ddlBindData");
    log(`Plot dropdown has ${plotOptions.length} options:`);

    // Find plot 128 and nearby plots
    const plot128 = plotOptions.find((o) => o.text.trim() === "128");
    const plotsStarting12x = plotOptions.filter((o) => {
      const t = o.text.trim();
      return t.startsWith("12") && t.length <= 5;
    });

    log(`Plot 128: ${plot128 ? `FOUND — value="${plot128.value}"` : "NOT FOUND"}`);
    log("Plots starting with 12x:");
    plotsStarting12x.forEach((o) => log(`  [${o.value}] "${o.text}"`));
    log("All plots (first 30):");
    plotOptions.slice(1, 31).forEach((o) => log(`  [${o.value}] "${o.text}"`));
    if (plotOptions.length > 31) {
      log(`  ... and ${plotOptions.length - 31} more`);
    }

    // Also try Chandaka (village code 2)
    section("STEP 7b: Chandaka — switch to Plot mode, enumerate ALL plots");
    log("Selecting Chandaka (village code 2)...");
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", "2");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    await page.waitForFunction(() => {
      const radio = document.querySelector<HTMLInputElement>(
        "#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0"
      );
      return !!radio && !radio.disabled;
    }, { timeout: 15_000 });

    await page.locator("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_1").click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout;

    const chandakaPlots = await readAllOptions(page, "#ctl00_ContentPlaceHolder1_ddlBindData");
    log(`Chandaka Plot dropdown has ${chandakaPlots.length} options:`);
    chandakaPlots.slice(1, 31).forEach((o) => log(`  [${o.value}] "${o.text}"`));

    // ── STEP 8: MULTIPLE APPROACHES to trigger View RoR ─────────────────
    section("STEP 8: Multiple approaches to trigger View RoR for Mendhasala plot 128");

    // Go back to Mendhasala plot 128
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", "105");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    await page.waitForFunction(() => {
      const radio = document.querySelector<HTMLInputElement>(
        "#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0"
      );
      return !!radio && !radio.disabled;
    }, { timeout: 15_000 });
    await page.locator("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_1").click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout;

    // Verify plot 128 is there
    const plotOpts = await readAllOptions(page, "#ctl00_ContentPlaceHolder1_ddlBindData");
    const p128 = plotOpts.find((o) => o.text.trim() === "128");
    if (!p128) {
      log("ERROR: Plot 128 not found! Skipping View RoR attempts.");
    } else {
      log(`Plot 128 found: value="${p128.value}", text="${p128.text}"`);

      // ── APPROACH A: SelectOption + Playwright click ───────────────────
      log("");
      log("--- APPROACH A: selectOption + Playwright click ---");
      await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", p128.value);
      await page.waitForTimeout;

      const btnVisibleA = await page.locator("#ctl00_ContentPlaceHolder1_btnRORFront").isVisible().catch(() => false);
      log(`btnRORFront visible after selectOption: ${btnVisibleA}`);

      if (btnVisibleA) {
        log("Clicking btnRORFront via Playwright...");
        const reqBeforeA = allRequests.length;
        await page.locator("#ctl00_ContentPlaceHolder1_btnRORFront").click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout;
        log(`Final URL after click: ${page.url().replace(BHULEKH_URL, "")}`);
        const reqsA = allRequests.slice(reqBeforeA);
        log(`AJAX requests: ${reqsA.length}`);
        reqsA.forEach((r) => {
          log(`  [${r.method()}] ${r.url().replace(BHULEKH_URL, "")}`);
          if (r.postData()) log(`    POST: ${r.postData()!.slice(0, 300)}`);
        });
      }

      // ── APPROACH B: Manual AJAX post with correct ddlBindData value ───
      log("");
      log("--- APPROACH B: Manual AJAX post with ddlBindData override ---");
      // Reset to plot 128
      await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", p128.value);
      await page.waitForTimeout(500);

      const fdB = await readFormData(page);
      log(`ddlBindData in form: "${fdB["ctl00$ContentPlaceHolder1$ddlBindData"]?.trim()}"`);

      // Override for the post
      const postBodyB = await buildPostBody(page, {
        "ctl00$ContentPlaceHolder1$ddlBindData": p128.value.trim(),
        "__EVENTTARGET": "ctl00$ContentPlaceHolder1$btnRORFront",
        "__EVENTARGUMENT": "",
        "ctl00$ScriptManager1": "ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$btnRORFront",
        "ctl00$ContentPlaceHolder1$btnRORFront": "View RoR",
      });

      const resultB = await doAjaxPost(page, postBodyB, "B");
      log(`Response status: ${resultB.status}`);
      log(`Response length: ${resultB.body.length} chars`);

      const parsedB = parseDeltaResponse(resultB.body);
      log(`pageRedirect: ${parsedB.redirect || "(none)"}`);
      log(`UpdatePanel HTML: ${parsedB.updatePanelHtml ? `${parsedB.updatePanelHtml.length} chars` : "(none)"}`);
      log(`Hidden fields updated: ${Object.keys(parsedB.hiddenFields).length}`);
      log(`Error: ${parsedB.hasError || "(none)"}`);

      // Check if page URL changed
      log(`Response URL: ${resultB.url.replace(BHULEKH_URL, "")}`);

      if (parsedB.updatePanelHtml) {
        // Check for redirect links in the updated panel
        const redirectLinks = parsedB.updatePanelHtml.match(/window\.location\.\w+\(['"]([^'"]+)['"]\)/g);
        const hyperLinkMatches = parsedB.updatePanelHtml.match(/HyperLink[^>]*href="([^"]+)"/g);
        const anchorMatches = parsedB.updatePanelHtml.match(/<a[^>]*href="([^"]*SRoR[^"]*)"[^>]*>/g);
        log(`Redirect links in panel: ${redirectLinks?.join(", ") || "(none)"}`);
        log(`HyperLink hrefs: ${hyperLinkMatches?.join("; ") || "(none)"}`);
        log(`Anchor hrefs with SRoR: ${anchorMatches?.join("; ") || "(none)"}`);

        // Also check for any URL-like strings
        const urlPattern = /['"]([^'"]*\.aspx[^'"]*)['"]/g;
        const urls = [...parsedB.updatePanelHtml.matchAll(urlPattern)].map((m) => m[1]);
        if (urls.length > 0) {
          log("URLs found in update panel:");
          urls.slice(0, 10).forEach((u) => log(`  ${u}`));
        }
      }

      // ── APPROACH C: Full postback (no AJAX) ───────────────────────────
      log("");
      log("--- APPROACH C: Full postback (no x-microsoftajax header) ---");
      const postBodyC = await buildPostBody(page, {
        "ctl00$ContentPlaceHolder1$ddlBindData": p128.value.trim(),
        "__EVENTTARGET": "ctl00$ContentPlaceHolder1$btnRORFront",
        "__EVENTARGUMENT": "",
        "ctl00$ContentPlaceHolder1$btnRORFront": "View RoR",
      });

      const resultC = await doFullPost(page, postBodyC, "C");
      log(`Response status: ${resultC.status}`);
      log(`Response URL: ${resultC.url.replace(BHULEKH_URL, "")}`);
      log(`Response length: ${resultC.body.length} chars`);
      log(`Content-type: ${resultC.body.slice(0, 200)}`);

      if (resultC.url.includes("SRoRFront")) {
        log("SUCCESS! Redirected to SRoRFront!");
      }

      // ── APPROACH D: Check if btnRORFront triggers with Khatiyan mode ───
      log("");
      log("--- APPROACH D: Khatiyan mode, first available khatiyan ---");
      await page.goto(ROR_VIEW_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
      if (page.url().includes("BhulekhError.aspx")) {
        await page.locator("a", { hasText: "here" }).click();
        await page.waitForURL(/RoRView\.aspx/, { timeout: TIMEOUT_MS });
      }

      await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", "20");
      await page.waitForLoadState("networkidle");
      await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", "2");
      await page.waitForLoadState("networkidle");
      await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", "105");
      await page.waitForLoadState("networkidle");

      await page.waitForFunction(() => {
        const radio = document.querySelector<HTMLInputElement>(
          "#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0"
        );
        return !!radio && !radio.disabled;
      }, { timeout: 15_000 });

      // Stay on Khatiyan mode (default)
      const khatiyanOpts = await readAllOptions(page, "#ctl00_ContentPlaceHolder1_ddlBindData");
      log(`Khatiyan options: ${khatiyanOpts.length}`);
      khatiyanOpts.slice(0, 10).forEach((o) => log(`  [${o.value}] "${o.text}"`));

      if (khatiyanOpts.length > 1) {
        const firstK = khatiyanOpts[1];
        log(`Selecting first khatiyan: "${firstK.text}"`);
        await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", firstK.value);
        await page.waitForTimeout(500);

        const btnVisibleD = await page.locator("#ctl00_ContentPlaceHolder1_btnRORFront").isVisible().catch(() => false);
        log(`btnRORFront visible: ${btnVisibleD}`);

        if (btnVisibleD) {
          const fdD = await readFormData(page);
          log(`ddlBindData in form: "${fdD["ctl00$ContentPlaceHolder1$ddlBindData"]}"`);
          log(`btnRORFront value: "${fdD["ctl00$ContentPlaceHolder1$btnRORFront"]}"`);

          // Try the AJAX post
          const postBodyD = await buildPostBody(page, {
            "ctl00$ContentPlaceHolder1$ddlBindData": firstK.value.trim(),
            "__EVENTTARGET": "ctl00$ContentPlaceHolder1$btnRORFront",
            "__EVENTARGUMENT": "",
            "ctl00$ScriptManager1": "ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$btnRORFront",
            "ctl00$ContentPlaceHolder1$btnRORFront": "View RoR",
          });

          const resultD = await doAjaxPost(page, postBodyD, "D");
          log(`Response status: ${resultD.status}`);
          const parsedD = parseDeltaResponse(resultD.body);
          log(`pageRedirect: ${parsedD.redirect || "(none)"}`);
          log(`Error: ${parsedD.hasError || "(none)"}`);

          if (parsedD.redirect) {
            log(`REDIRECT: ${parsedD.redirect}`);
          }
        }
      }

      // ── APPROACH E: Try Tenant mode ──────────────────────────────────
      log("");
      log("--- APPROACH E: Tenant mode for village 105 ---");
      await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", "105");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      await page.waitForFunction(() => {
        const radio = document.querySelector<HTMLInputElement>(
          "#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_2"
        );
        return !!radio && !radio.disabled;
      }, { timeout: 15_000 });

      await page.locator("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_2").click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout;

      const tenantOpts = await readAllOptions(page, "#ctl00_ContentPlaceHolder1_ddlBindData");
      log(`Tenant dropdown has ${tenantOpts.length} options:`);
      tenantOpts.slice(0, 20).forEach((o) => log(`  [${o.value}] "${o.text}"`));

      if (tenantOpts.length > 1) {
        const firstT = tenantOpts[1];
        log(`Selecting first tenant: "${firstT.text}"`);
        await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", firstT.value);
        await page.waitForTimeout(500);

        const btnVisibleE = await page.locator("#ctl00_ContentPlaceHolder1_btnRORFront").isVisible().catch(() => false);
        log(`btnRORFront visible: ${btnVisibleE}`);

        if (btnVisibleE) {
          const fdE = await readFormData(page);
          const postBodyE = await buildPostBody(page, {
            "ctl00$ContentPlaceHolder1$ddlBindData": firstT.value.trim(),
            "__EVENTTARGET": "ctl00$ContentPlaceHolder1$btnRORFront",
            "__EVENTARGUMENT": "",
            "ctl00$ScriptManager1": "ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$btnRORFront",
            "ctl00$ContentPlaceHolder1$btnRORFront": "View RoR",
          });

          const resultE = await doAjaxPost(page, postBodyE, "E");
          const parsedE = parseDeltaResponse(resultE.body);
          log(`pageRedirect: ${parsedE.redirect || "(none)"}`);
          log(`Error: ${parsedE.hasError || "(none)"}`);
          if (parsedE.redirect) log(`REDIRECT: ${parsedE.redirect}`);
        }
      }

      // ── APPROACH F: Inspect the ACTUAL onchange handler on ddlBindData ─
      log("");
      log("--- APPROACH F: Inspect ddlBindData onchange and submit handlers ---");
      const handlers = await page.evaluate(() => {
        const ddl = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
        const form = document.forms[0] as HTMLFormElement | null;
        const btn = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_btnRORFront");
        const scriptMgr = document.querySelector<HTMLInputElement>("input[name='ctl00$ScriptManager1']");
        const updatePanel = document.getElementById("ctl00_ContentPlaceHolder1_UpdatePanel1");
        const bodyOnSubmit = document.body.getAttribute("onsubmit") || "(none)";
        const formOnSubmit = form?.getAttribute("onsubmit") || "(none)";

        return {
          ddlOnChange: ddl?.getAttribute("onchange") || "(none)",
          ddlOnFocus: ddl?.getAttribute("onfocus") || "(none)",
          btnOnClientClick: btn?.getAttribute("onclientclick") || btn?.getAttribute("onclick") || "(none)",
          scriptMgrValue: scriptMgr?.value || "(none)",
          updatePanelHTML: updatePanel?.outerHTML.slice(0, 500) || "(none)",
          bodyOnSubmit,
          formOnSubmit,
          allScriptContents: Array.from(document.querySelectorAll("script")).map(s => s.textContent || "").filter(t => t.includes("btnROR") || t.includes("ddlBind")).slice(0, 3),
        };
      });
      log(`ddlBindData onchange: ${handlers.ddlOnChange}`);
      log(`ddlBindData onfocus: ${handlers.ddlOnFocus}`);
      log(`btnRORFront onclick: ${handlers.btnOnClientClick}`);
      log(`ScriptManager value: ${handlers.scriptMgrValue}`);
      log(`Body onsubmit: ${handlers.bodyOnSubmit.slice(0, 200)}`);
      log(`Form onsubmit: ${handlers.formOnSubmit.slice(0, 200)}`);
      if (handlers.allScriptContents.length > 0) {
        log("Script blocks with btnROR/ddlBind:");
        handlers.allScriptContents.forEach((s, i) => log(`  Script ${i+1}: ${s.slice(0, 300)}`));
      }

      // ── APPROACH G: Try page.goto to SRoRFront with query params ────
      log("");
      log("--- APPROACH G: Try direct navigation to SRoRFront_Uni.aspx ---");
      // Try various URL patterns for the RoR report page
      const rorPatterns = [
        `${BHULEKH_URL}/SRoRFront_Uni.aspx`,
        `${BHULEKH_URL}/SRoRFront.aspx`,
        `${BHULEKH_URL}/SRoRFront_Uni.aspx?District=${encodeURIComponent("20")}&Tahsil=${encodeURIComponent("2")}&Village=${encodeURIComponent("105")}&Plot=${encodeURIComponent("128")}`,
        `${BHULEKH_URL}/SRoRFront_Uni.aspx?distcode=20&subcode=2&villcode=105&plotno=128`,
      ];

      for (const url of rorPatterns) {
        try {
          const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
          log(`GET ${url.replace(BHULEKH_URL, "")} => ${resp?.status()}, URL: ${page.url().replace(BHULEKH_URL, "")}`);
          if (page.url().includes("SRoR")) {
            log("Landed on SRoR page!");
            const title = await page.title();
            log(`Page title: ${title}`);
            break;
          }
        } catch (e) {
          log(`GET failed: ${String(e).slice(0, 100)}`);
        }
      }

      // ── APPROACH H: Try the page's own form submit mechanism ─────────
      log("");
      log("--- APPROACH H: Intercept and replay form submit ---");
      await page.goto(ROR_VIEW_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
      if (page.url().includes("BhulekhError.aspx")) {
        await page.locator("a", { hasText: "here" }).click();
        await page.waitForURL(/RoRView\.aspx/, { timeout: TIMEOUT_MS });
      }

      await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", "20");
      await page.waitForLoadState("networkidle");
      await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", "2");
      await page.waitForLoadState("networkidle");
      await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", "105");
      await page.waitForLoadState("networkidle");
      await page.waitForFunction(() => {
        const radio = document.querySelector<HTMLInputElement>(
          "#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0"
        );
        return !!radio && !radio.disabled;
      }, { timeout: 15_000 });
      await page.locator("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_1").click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout;

      // Select plot 128
      const plotOptsH = await readAllOptions(page, "#ctl00_ContentPlaceHolder1_ddlBindData");
      const p128H = plotOptsH.find((o) => o.text.trim() === "128");
      if (p128H) {
        await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", p128H.value);
        await page.waitForTimeout(1000);

        // Try submitting via form.submit() with spy
        const formState = await page.evaluate(async () => {
          const form = document.forms[0] as HTMLFormElement;
          const ddl = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
          const btn = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_btnRORFront");

          if (ddl) ddl.value = "128                           ";
          if (btn) btn.click();

          return { formAction: form?.action, formMethod: form?.method };
        });
        log(`Form action: ${formState.formAction}`);
        log(`Form method: ${formState.formMethod}`);

        await page.waitForTimeout;
        log(`URL after form.submit(): ${page.url().replace(BHULEKH_URL, "")}`);
      }
    }

    // ── STEP 9: Summary ────────────────────────────────────────────────
    section("STEP 9: Network request summary");
    const bhulekhRequests = allRequests.filter((r) => r.url().includes("bhulekh"));
    log(`Total Bhulekh requests: ${bhulekhRequests.length}`);
    const postRequests = bhulekhRequests.filter((r) => r.method() === "POST");
    log(`POST requests: ${postRequests.length}`);
    const xhrRequests = bhulekhRequests.filter(
      (r) => r.resourceType() === "xhr" || r.resourceType() === "fetch"
    );
    log(`AJAX requests: ${xhrRequests.length}`);

    // Show all POST bodies that mention btnRORFront
    const rorPosts = postRequests.filter((r) => r.postData()?.includes("btnRORFront"));
    log(`POST requests with btnRORFront: ${rorPosts.length}`);
    rorPosts.forEach((r, i) => {
      log(`  POST ${i + 1}: ${r.url().replace(BHULEKH_URL, "")}`);
      log(`    Body: ${r.postData()?.slice(0, 500)}`);
    });

    // ── Save results ────────────────────────────────────────────────────
    section("SAVING RESULTS");
    const report = `# Bhulekh Desperate Probe Results
Generated: ${new Date().toISOString()}

## Summary

This probe enumerated ALL dropdown options at every cascade level and tried
8 different approaches to trigger the View RoR action for Mendhasala (village 105),
Khordha district, Bhubaneswar tahasil.

## Dropdown Enumeration

### District options
- Total: ${districts.length}
- Khordha confirmed at code 20

### Tahasil options for district 20
- Total: ${allTahasils.length}
${allTahasils.map((t) => `  - [${t.value}] "${t.text}"${t.value === "2" ? " (Bhubaneswar)" : ""}`).join("\n")}

### Village count per tahasil (district 20)
${Object.entries(tahasilVillageCounts).map(([tVal, count]) => {
  const tName = allTahasils.find((t) => t.value === tVal)?.text || tVal;
  return `- Tahasil ${tVal} (${tName}): ${count} villages`;
}).join("\n")}

### Village 105 (Mendhasala) details
${village105 ? `- Text: "${village105.text}"` : "- NOT FOUND in villages list"}
${village2 ? `- Village 2 (Chandaka): "${village2.text}"` : "- Village 2 NOT FOUND"}

### Mendhasala Plot enumeration
${plotOptions ? `- Total plots: ${plotOptions.length}` : "- Not enumerated"}
${plot128 ? `- Plot 128: value="${plot128.value}" text="${plot128.text}"` : "- Plot 128 NOT FOUND"}
${plotsStarting12x.length > 0 ? `- Nearby plots (12x): ${plotsStarting12x.map((p) => `"${p.text}" (value="${p.value}")`).join(", ")}` : ""}

### Chandaka Plot enumeration
${chandakaPlots ? `- Total plots: ${chandakaPlots.length}` : "- Not enumerated"}

## View RoR Trigger Attempts

### Approach A: Playwright click on btnRORFront
${btnVisibleA ? "btnRORFront was visible — clicked" : "btnRORFront was NOT visible"}
Result: See network request log

### Approach B: AJAX post with ddlBindData override
- pageRedirect: ${parsedB?.redirect || "(none)"}
- Error: ${parsedB?.hasError || "(none)"}
- UpdatePanel updated: ${parsedB?.updatePanelHtml ? "YES" : "NO"}

### Approach C: Full postback (no AJAX headers)
- Final URL: See log above
- Landed on SRoR: ${resultC?.url?.includes("SRoR") ? "YES" : "NO/UNKNOWN"}

### Approach D: Khatiyan mode first available entry
${khatiyanOpts && khatiyanOpts.length > 1 ? `- First khatiyan: "${khatiyanOpts[1].text}" (value="${khatiyanOpts[1].value}")` : "- Khatiyan options not available"}
- pageRedirect: ${parsedD?.redirect || "(none)"}

### Approach E: Tenant mode first available entry
${tenantOpts && tenantOpts.length > 1 ? `- First tenant: "${tenantOpts[1].text}" (value="${tenantOpts[1].value}")` : "- Tenant options not available"}
- pageRedirect: ${parsedE?.redirect || "(none)"}

### Approach F: Handler inspection
- ddlBindData onchange: ${handlers?.ddlOnChange || "(none)"}
- btnRORFront onclick: ${handlers?.btnOnClientClick || "(none)"}

### Approach G: Direct SRoRFront navigation
See log for results.

### Approach H: Form.submit() interception
See log for results.

## Key Findings

${(() => {
  const findings: string[] = [];
  if (!plot128) findings.push("1. Plot 128 NOT found in Mendhasala village 105 dropdown");
  if (!mendhasalaMatches.length && !mendhasalMatch.length) findings.push("2. Village code 105 does NOT contain 'mendhasala' in its text — village mapping may be wrong");
  if (!chandakaMatch.length) findings.push("3. Village code 2 does NOT contain 'chandaka' in its text — village mapping may be wrong");
  if (parsedB && !parsedB.redirect) findings.push("4. AJAX View RoR post returns NO pageRedirect — the delta response only updates hidden fields");
  if (parsedD && !parsedD.redirect) findings.push("5. Khatiyan-mode View RoR post also returns NO pageRedirect");
  if (parsedE && !parsedE.redirect) findings.push("6. Tenant-mode View RoR post also returns NO pageRedirect");
  if (chandakaPlots && chandakaPlots.length < plotOptions.length) findings.push(`7. Chandaka has fewer plots (${chandakaPlots.length}) than Mendhasala (${plotOptions.length}) — village codes may be swapped`);
  if (findings.length === 0) findings.push("No critical findings — review logs above");
  return findings.join("\n");
})()}

## Next Steps

${(() => {
  const steps: string[] = [];
  if (!plot128) {
    steps.push("1. CRITICAL: Verify village code 105 is correct for Mendhasala — the Odia village name in the dropdown does NOT contain 'mendhasala' text");
    steps.push("2. Check if Mendhasala has plots — if ddlBindData is empty or has 0-1 options, the village has no records in Bhulekh");
  }
  steps.push("3. If no pageRedirect is ever produced, Bhulekh may require a full page reload (not AJAX) to navigate to the RoR page");
  steps.push("4. Try: intercept the full POST response body and check if it contains HTML for the SRoR page embedded within the delta format");
  steps.push("5. Try: use page.goto() to navigate directly to SRoRFront_Uni.aspx with known parameter names");
  return steps.join("\n");
})()}

---

## Full Log

${logLines.join("\n")}
`;

    fs.writeFileSync(PROBE_OUTPUT, report);
    log(`\nResults saved to: ${PROBE_OUTPUT}`);

  } catch (err) {
    log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    fs.writeFileSync(PROBE_OUTPUT, `# Bhulekh Desperate Probe — ERROR\n\nError: ${err instanceof Error ? err.message : String(err)}\n\nLog:\n${logLines.join("\n")}`);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
