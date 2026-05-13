/**
 * Bhulekh CSRF-Aware Probe
 *
 * Finding from bhulekh-desperate-probe: Bhulekh uses a CSRF token
 * (ctl00$csrfval) and AJAX posts return Error: 500.
 *
 * This probe:
 * 1. Captures the CSRF token from every page state
 * 2. Tries AJAX post WITH correct csrfval
 * 3. Tries full postback with correct csrfval
 * 4. Catches the navigation from full postback
 * 5. Parses the resulting SRoR page if reached
 *
 * Run: npx tsx scripts/probe/bhulekh-csrf-probe.ts
 */

import { chromium, type Page, type Response } from "playwright";
import * as fs from "fs";

const BHULEKH_URL = "https://bhulekh.ori.nic.in";
const ROR_VIEW_URL = `${BHULEKH_URL}/RoRView.aspx`;
const TIMEOUT_MS = 30_000;
const OUTPUT = "/Users/deekshamohapatra/Documents/cleardeed/scripts/probe/bhulekh-csrf-probe.md";

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

async function readOptions(page: Page, selector: string): Promise<{value: string; text: string}[]> {
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

function buildUrlEncoded(formData: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(formData)) {
    params.append(k, v);
  }
  return params.toString();
}

async function doAjaxPost(page: Page, formData: Record<string, string>): Promise<{status: number; body: string; url: string}> {
  return page.evaluate(async (fd) => {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(fd)) { body.append(k, v); }
    const resp = await fetch(window.location.href, {
      method: "POST",
      body: body.toString(),
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

function parseDelta(body: string): {
  redirect?: string;
  updatePanelHtml?: string;
  hiddenFields: Record<string, string>;
  error?: string;
} {
  const result = { hiddenFields: {} as Record<string, string> };

  const redirectMatch = body.match(/pageRedirect\|\|([^|]+)/);
  if (redirectMatch) result.redirect = decodeURIComponent(redirectMatch[1]);

  const panelMatch = body.match(/updatePanel\|ctl00_ContentPlaceHolder1_UpdatePanel1\|([\s\S]*?)(?=\|hiddenField\||\|scriptBlock\||\|pageRedirect\||\|asyncPostBack)/);
  if (panelMatch) result.updatePanelHtml = panelMatch[1];

  for (const match of body.matchAll(/hiddenField\|([^|]+)\|([^|]*)\|/g)) {
    result.hiddenFields[match[1]] = match[2];
  }

  const errMatch = body.match(/error\|([^|]+)/);
  if (errMatch) result.error = errMatch[1];

  return result;
}

async function getPlot128Value(page: Page): Promise<string | null> {
  const opts = await readOptions(page, "#ctl00_ContentPlaceHolder1_ddlBindData");
  const p128 = opts.find((o) => o.text.trim() === "128");
  return p128?.value ?? null;
}

async function setupVillage(page: Page): Promise<void> {
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

  await page.locator("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_1").click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    log("Starting Bhulekh CSRF-Aware Probe");
    log(`Time: ${new Date().toISOString()}`);

    // ── STEP 1: Capture CSRF token on initial load ─────────────────────
    section("STEP 1: Capture CSRF token at each stage");

    await page.goto(ROR_VIEW_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    if (page.url().includes("BhulekhError.aspx")) {
      await page.locator("a", { hasText: "here" }).click();
      await page.waitForURL(/RoRView\.aspx/, { timeout: TIMEOUT_MS });
    }

    const csrfAfterBootstrap = await page.evaluate(() => {
      const csrfInput = document.querySelector<HTMLInputElement>("input[name='ctl00$csrfval']");
      const allHiddenInputs = Array.from(document.querySelectorAll("input[type='hidden']")).map(i => ({
        name: i.name, id: i.id, value: i.value.slice(0, 30)
      }));
      return {
        csrfval: csrfInput?.value || "(not found)",
        hiddenCount: allHiddenInputs.length,
        hiddenInputs: allHiddenInputs,
      };
    });
    log(`CSRF after bootstrap: ${csrfAfterBootstrap.csrfval.slice(0, 20)}...`);
    log(`Hidden inputs: ${csrfAfterBootstrap.hiddenCount}`);
    csrfAfterBootstrap.hiddenInputs.forEach((h) => {
      if (h.name.includes("VIEWSTATE") || h.name.includes("EVENT") || h.name.includes("csrf")) {
        log(`  ${h.name}: ${h.value}...`);
      }
    });

    // ── STEP 2: CSRF after district+tahasil+village selection ───────────
    section("STEP 2: CSRF after village selection (Mendhasala 105)");

    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", "20");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", "2");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", "105");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);

    const csrfAfterVillage = await page.evaluate(() => {
      const csrfInput = document.querySelector<HTMLInputElement>("input[name='ctl00$csrfval']");
      return csrfInput?.value || "(not found)";
    });
    log(`CSRF after village: ${csrfAfterVillage.slice(0, 20)}...`);
    log(`CSRF changed: ${csrfAfterVillage !== csrfAfterBootstrap.csrfval ? "YES" : "NO"}`);

    // ── STEP 3: CSRF after switching to Plot mode ───────────────────────
    section("STEP 3: CSRF after Plot mode switch");

    await page.waitForFunction(() => {
      const r = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0");
      return !!r && !r.disabled;
    }, { timeout: 15_000 });

    await page.locator("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_1").click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout;

    const csrfAfterPlot = await page.evaluate(() => {
      const csrfInput = document.querySelector<HTMLInputElement>("input[name='ctl00$csrfval']");
      return csrfInput?.value || "(not found)";
    });
    log(`CSRF after Plot switch: ${csrfAfterPlot.slice(0, 20)}...`);
    log(`CSRF changed: ${csrfAfterPlot !== csrfAfterVillage ? "YES" : "NO"}`);

    // ── STEP 4: Full form capture BEFORE selecting plot ─────────────────
    section("STEP 4: Full form data capture before plot selection");

    const formBeforePlot = await readFormData(page);
    log(`Form keys: ${Object.keys(formBeforePlot).length}`);
    for (const [k, v] of Object.entries(formBeforePlot)) {
      if (k.includes("VIEWSTATE") || k.includes("EVENT") || k.includes("csrf") || k.includes("ddlDistrict") || k.includes("ddlTahsil") || k.includes("ddlVillage") || k.includes("rbtnROR")) {
        log(`  ${k}: ${v.slice(0, 50)}${v.length > 50 ? "..." : ""}`);
      }
    }
    log(`rbtnRORSearchtype: ${formBeforePlot["ctl00$ContentPlaceHolder1$rbtnRORSearchtype"]}`);
    log(`ddlDistrict: ${formBeforePlot["ctl00$ContentPlaceHolder1$ddlDistrict"]}`);
    log(`ddlTahsil: ${formBeforePlot["ctl00$ContentPlaceHolder1$ddlTahsil"]}`);
    log(`ddlVillage: ${formBeforePlot["ctl00$ContentPlaceHolder1$ddlVillage"]}`);

    // ── STEP 5: Select plot 128 and capture form again ─────────────────
    section("STEP 5: Select plot 128 and capture form");

    const p128Value = await getPlot128Value(page);
    if (!p128Value) {
      log("ERROR: Plot 128 not found!");
    } else {
      log(`Plot 128 value: "${p128Value}"`);
      await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", p128Value);
      await page.waitForTimeout;

      const formAfterPlot = await readFormData(page);
      log(`Form ddlBindData after selection: "${formAfterPlot["ctl00$ContentPlaceHolder1$ddlBindData"]}"`);
      log(`CSRF after plot selection: ${formAfterPlot["ctl00$csrfval"]?.slice(0, 20)}...`);

      // Check btnRORFront
      const btnInfo = await page.evaluate(() => {
        const btn = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_btnRORFront");
        return {
          visible: btn?.offsetParent !== null,
          disabled: btn?.disabled,
          value: btn?.value || "(none)",
          name: btn?.name || "(none)",
        };
      });
      log(`btnRORFront: visible=${btnInfo.visible}, disabled=${btnInfo.disabled}, value="${btnInfo.value}"`);

      // ── STEP 6: APPROACH A — AJAX post WITH correct csrfval ───────────
      section("STEP 6: Approach A — AJAX post with csrfval");

      const postBodyA: Record<string, string> = { ...formAfterPlot };
      postBodyA["__EVENTTARGET"] = "ctl00$ContentPlaceHolder1$btnRORFront";
      postBodyA["__EVENTARGUMENT"] = "";
      postBodyA["ctl00$ScriptManager1"] = "ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$btnRORFront";
      postBodyA["ctl00$ContentPlaceHolder1$btnRORFront"] = "View RoR";

      log(`CSRF in POST: ${postBodyA["ctl00$csrfval"]?.slice(0, 20)}...`);
      log(`ddlBindData in POST: "${postBodyA["ctl00$ContentPlaceHolder1$ddlBindData"]}"`);

      const resultA = await doAjaxPost(page, postBodyA);
      log(`Status: ${resultA.status}`);
      log(`Body length: ${resultA.body.length} chars`);

      const parsedA = parseDelta(resultA.body);
      log(`pageRedirect: ${parsedA.redirect || "(none)"}`);
      log(`Error: ${parsedA.error || "(none)"}`);
      log(`UpdatePanel: ${parsedA.updatePanelHtml ? `${parsedA.updatePanelHtml.length} chars` : "(none)"}`);
      log(`Hidden fields: ${Object.keys(parsedA.hiddenFields).length}`);

      // Check for error details in response body
      if (resultA.body.includes("error") || resultA.body.includes("Error")) {
        const errIdx = resultA.body.toLowerCase().indexOf("error");
        log(`Error context: ${resultA.body.slice(Math.max(0, errIdx - 20), errIdx + 200)}`);
      }

      // Check for any URL-like strings in the response
      const srorMatches = resultA.body.match(/SRoR[a-zA-Z0-9_]*/g);
      if (srorMatches?.length) log(`SRoR references in response: ${srorMatches.slice(0, 10).join(", ")}`);

      // ── STEP 7: APPROACH B — Full POST with csrfval ──────────────────
      section("STEP 7: Approach B — Full postback with csrfval");

      const postBodyB: Record<string, string> = { ...formAfterPlot };
      postBodyB["__EVENTTARGET"] = "ctl00$ContentPlaceHolder1$btnRORFront";
      postBodyB["__EVENTARGUMENT"] = "";
      postBodyB["ctl00$ContentPlaceHolder1$btnRORFront"] = "View RoR";

      log("Sending full postback (non-AJAX)...");

      // Capture response before navigation
      let postResponse: Response | null = null;
      page.on("response", (resp) => {
        if (resp.url().includes("bhulekh") && resp.request().method() === "POST") {
          postResponse = resp;
        }
      });

      const didNavigate = await page.evaluate(async (fd) => {
        const body = buildUrlEncoded(fd);
        const resp = await fetch(window.location.href, {
          method: "POST",
          body,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          },
          credentials: "include",
        });
        // If status is 200 and we got HTML back, check if it redirected
        if (resp.status === 200) {
          const text = await resp.text();
          // Check if this is still RoRView or a new page
          if (text.includes("SRoRFront")) {
            return "SRoR_FOUND_IN_RESPONSE";
          }
          // Check for redirect meta tags
          if (text.includes("location.href") || text.includes("window.location")) {
            const locMatch = text.match(/window\.location(?:\.\w+)?\s*=\s*['"]([^'"]+)['"]/);
            if (locMatch) return `REDIRECT:${locMatch[1]}`;
          }
          if (resp.url.includes("SRoRFront")) {
            return "REDIRECTED_TO_SROR";
          }
          return `SAME_PAGE:${resp.url}`;
        }
        return `HTTP_${resp.status}:${resp.url}`;
      }, postBodyB);

      log(`Full postback result: ${didNavigate}`);

      // Try navigation after postback
      if (didNavigate?.startsWith("REDIRECT:") || didNavigate === "REDIRECTED_TO_SROR") {
        const redirectUrl = didNavigate.replace("REDIRECT:", "").replace("REDIRECTED_TO_SROR", "");
        log(`Redirect URL found: ${redirectUrl}`);
        if (redirectUrl && redirectUrl !== "SRoR_FOUND_IN_RESPONSE") {
          try {
            await page.goto(new URL(redirectUrl, BHULEKH_URL).toString(), {
              waitUntil: "domcontentloaded",
              timeout: TIMEOUT_MS,
            });
            log(`Navigated to: ${page.url().replace(BHULEKH_URL, "")}`);
          } catch (e) {
            log(`Navigation failed: ${e}`);
          }
        }
      } else if (didNavigate === "SRoR_FOUND_IN_RESPONSE") {
        log("SRoRFront found in POST response body!");
      }

      // ── STEP 8: APPROACH C — Playwright click with request interception ─
      section("STEP 8: Approach C — Playwright click, intercept POST response");

      // Go back and re-setup
      await page.goto(ROR_VIEW_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
      if (page.url().includes("BhulekhError.aspx")) {
        await page.locator("a", { hasText: "here" }).click();
        await page.waitForURL(/RoRView\.aspx/, { timeout: TIMEOUT_MS });
      }
      await setupVillage(page);
      const p128C = await getPlot128Value(page);
      if (p128C) {
        await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", p128C);
        await page.waitForTimeout;

        // Intercept the response from btnRORFront click
        let capturedResponse: { status: number; body: string; url: string } | null = null;
        page.on("response", async (resp) => {
          if (resp.url().includes("bhulekh") && resp.request().method() === "POST" && capturedResponse === null) {
            capturedResponse = { status: resp.status, body: await resp.text(), url: resp.url() };
          }
        });

        const clickResult = await page.evaluate(() => {
          const btn = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1$btnRORFront");
          if (btn) {
            btn.click();
            return "clicked";
          }
          const btnById = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_btnRORFront");
          if (btnById) {
            btnById.click();
            return "clicked_by_id";
          }
          return "not_found";
        });

        log(`Click result: ${clickResult}`);
        await page.waitForTimeout;
        log(`URL after click: ${page.url().replace(BHULEKH_URL, "")}`);

        if (capturedResponse) {
          log(`Captured POST response: status=${capturedResponse.status}, length=${capturedResponse.body.length}`);
          const parsedC = parseDelta(capturedResponse.body);
          log(`pageRedirect: ${parsedC.redirect || "(none)"}`);
          log(`Error: ${parsedC.error || "(none)"}`);
          log(`UpdatePanel: ${parsedC.updatePanelHtml ? `${parsedC.updatePanelHtml.length} chars` : "(none)"}`);

          // Print first 500 chars of response body
          log(`Response body (first 500): ${capturedResponse.body.slice(0, 500)}`);
        } else {
          log("No POST response captured — navigation may have occurred too fast");
        }
      }

      // ── STEP 9: APPROACH D — Try reading SRoR URL from hidden fields ──
      section("STEP 9: Approach D — Check if SRoR URL is in hidden fields after AJAX post");

      // First re-setup village
      await page.goto(ROR_VIEW_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
      if (page.url().includes("BhulekhError.aspx")) {
        await page.locator("a", { hasText: "here" }).click();
        await page.waitForURL(/RoRView\.aspx/, { timeout: TIMEOUT_MS });
      }
      await setupVillage(page);
      const p128D = await getPlot128Value(page);
      if (p128D) {
        await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", p128D);
        await page.waitForTimeout;

        // Do AJAX post
        const formD = await readFormData(page);
        const postD: Record<string, string> = { ...formD };
        postD["__EVENTTARGET"] = "ctl00$ContentPlaceHolder1$btnRORFront";
        postD["__EVENTARGUMENT"] = "";
        postD["ctl00$ScriptManager1"] = "ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$btnRORFront";
        postD["ctl00$ContentPlaceHolder1$btnRORFront"] = "View RoR";

        const resultD = await doAjaxPost(page, postD);

        // Check hidden fields after post
        const hiddenAfterD = await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll("input[type='hidden']")).map(i => ({
            name: i.name, id: i.id, value: (i.value || "").slice(0, 50)
          }));
          return inputs.filter(i =>
            i.name.includes("SRoR") || i.name.includes("Redirect") ||
            i.value.includes("SRoR") || i.id.includes("SRoR") ||
            i.name.includes("url", ) || i.id.includes("url")
          );
        });
        log(`Hidden fields mentioning SRoR/Redirect: ${hiddenAfterD.length}`);
        hiddenAfterD.forEach(h => log(`  ${h.name}: ${h.value}...`));

        // Check ALL hidden fields for anything URL-like
        const allHidden = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("input[type='hidden']")).map(i => ({
            name: i.name, id: i.id, value: (i.value || "").slice(0, 100)
          }));
        });
        if (allHidden.length > 0) {
          log(`All hidden fields (${allHidden.length} total):`);
          allHidden.forEach(h => {
            if (!h.name.includes("VIEWSTATE") && !h.name.includes("EVENT")) {
              log(`  ${h.name}: ${h.value}`);
            }
          });
        }
      }

      // ── STEP 10: APPROACH E — Try ASP.NET post with ScriptManager ──────
      section("STEP 10: Approach E — Direct navigation to SRoRFront_Uni.aspx with params");

      const srorUrls = [
        `${BHULEKH_URL}/SRoRFront_Uni.aspx`,
        `${BHULEKH_URL}/SRoRFront.aspx`,
        `${BHULEKH_URL}/SRoRFront_Uni.aspx?distcode=20&subcode=2&villcode=105&plotno=128`,
        `${BHULEKH_URL}/SRoRFront_Uni.aspx?District=${encodeURIComponent("20")}&Tahsil=${encodeURIComponent("2")}&Village=${encodeURIComponent("105")}&PlotNo=${encodeURIComponent("128")}`,
      ];

      for (const url of srorUrls) {
        try {
          const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
          const finalUrl = page.url();
          const content = await page.content();
          const hasSRoR = content.includes("SRoR") || content.includes("ROR") || content.includes("RoR");
          log(`GET ${url.replace(BHULEKH_URL, "")} => HTTP ${resp?.status()}, has RoR content: ${hasSRoR}`);
          log(`  Final URL: ${finalUrl.replace(BHULEKH_URL, "")}`);

          if (hasSRoR) {
            // Try to parse the page
            const pageTitle = await page.title();
            const ownerNames = await page.evaluate(() => {
              const cells = Array.from(document.querySelectorAll("td")).map(t => t.textContent?.trim()).filter(Boolean);
              return cells.slice(0, 50);
            });
            log(`  Page title: ${pageTitle}`);
            log(`  Content samples: ${ownerNames.slice(0, 10).join(" | ")}`);

            if (finalUrl.includes("SRoR")) {
              log("SUCCESS — Landed on SRoR page!");
              // Save the HTML
              fs.writeFileSync("/tmp/bhulekh-sror-success.html", content);
              log("SRoR page saved to /tmp/bhulekh-sror-success.html");
              break;
            }
          }
        } catch (e) {
          log(`GET ${url.replace(BHULEKH_URL, "")} => ERROR: ${String(e).slice(0, 100)}`);
        }
      }

    }

    // ── STEP 11: Try Khatiyan mode with plot 1 ──────────────────────────
    section("STEP 11: Try Khatiyan mode (plot 1) as baseline test");

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

    // Stay on Khatiyan (default)
    const khatiyanOpts = await readOptions(page, "#ctl00_ContentPlaceHolder1_ddlBindData");
    log(`Khatiyan options: ${khatiyanOpts.length}`);
    if (khatiyanOpts.length > 1) {
      const firstK = khatiyanOpts[1];
      log(`Selecting first khatiyan: "${firstK.text}" value="${firstK.value}"`);
      await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", firstK.value);
      await page.waitForTimeout;

      const btnK = await page.evaluate(() => {
        const btn = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_btnRORFront");
        return { visible: btn?.offsetParent !== null, disabled: btn?.disabled };
      });
      log(`btnRORFront visible=${btnK.visible}, disabled=${btnK.disabled}`);

      if (btnK.visible) {
        // Try full postback
        const formK = await readFormData(page);
        const postK: Record<string, string> = { ...formK };
        postK["__EVENTTARGET"] = "ctl00$ContentPlaceHolder1$btnRORFront";
        postK["__EVENTARGUMENT"] = "";
        postK["ctl00$ContentPlaceHolder1$btnRORFront"] = "View RoR";

        const didNavK = await page.evaluate(async (fd) => {
          const body = buildUrlEncoded(fd);
          const resp = await fetch(window.location.href, {
            method: "POST",
            body,
            headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
            credentials: "include",
          });
          const text = await resp.text();
          if (text.includes("SRoRFront")) return "SRoR_IN_BODY";
          const locMatch = text.match(/window\.location(?:\.\w+)?\s*=\s*['"]([^'"]+)['"]/);
          if (locMatch) return `REDIRECT:${locMatch[1]}`;
          return `SAME:${resp.url}`;
        }, postK);

        log(`Khatiyan full postback: ${didNavK}`);
      }
    }

    // ── Save ────────────────────────────────────────────────────────────
    section("SAVING");
    const report = `# Bhulekh CSRF Probe Results
Generated: ${new Date().toISOString()}

## Key Findings

1. Bhulekh uses CSRF token (ctl00$csrfval) — must be included in all POSTs
2. AJAX posts (x-microsoftajax header) return Error: 500
3. Full postback may navigate to SRoRFront — need to capture response
4. Mendhasala village 105 confirmed in Bhubaneswar tahasil (code 2)
5. Plot 128 confirmed in Mendhasala (value has trailing spaces)

## CSRF Token Behavior

- Token changes after each AJAX/post interaction
- Must be re-read from page before each POST
- Stored in hidden input: name="ctl00$csrfval"

## Approaches Tested

See full log below for each approach's result.

## Full Log

${logLines.join("\n")}
`;
    fs.writeFileSync(OUTPUT, report);
    log(`\nResults saved to: ${OUTPUT}`);

  } catch (err) {
    log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    const report = `# Bhulekh CSRF Probe — ERROR\n\n${err instanceof Error ? err.message : String(err)}\n\nLog:\n${logLines.join("\n")}`;
    fs.writeFileSync(OUTPUT, report);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
