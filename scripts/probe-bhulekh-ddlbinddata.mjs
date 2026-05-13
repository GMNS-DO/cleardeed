/**
 * Bhulekh RoRView.aspx post-plot-selection probe (ESM/JS version)
 *
 * Goal: Find the exact action (button? postback? AJAX?) that triggers the RoR
 * after the user selects a plot number from ddlBindData.
 *
 * Key finding: Playwright's selectOption() does NOT reliably fire ASP.NET's
 * __doPostBack() handler (the onchange attribute). We must call __doPostBack()
 * manually via page.evaluate() after each selectOption().
 */

import { chromium } from "playwright";
import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── ASP.NET-aware selection helper ──────────────────────────────────────────
// Bhulekh dropdowns use onchange="javascript:setTimeout('__doPostBack(...)', 0)"
// Playwright selectOption() updates the DOM but does NOT reliably call this
// handler. We trigger __doPostBack manually after each selection.
async function aspSelect(page, selectSelector, value, postbackTarget) {
  const select = page.locator(selectSelector).first();
  // Wait for the element to be in the DOM
  await select.waitFor({ state: "attached", timeout: 10000 });
  const initCount = await select.locator("option").count();
  console.log(`    aspSelect: ${selectSelector} initial options=${initCount}`);

  // Fire ASP.NET postback FIRST (this triggers the server-side update)
  await page.evaluate(
    (target) => {
      if (typeof __doPostBack !== "undefined") {
        __doPostBack(target, "");
      }
    },
    postbackTarget
  );

  // Wait for options to appear AFTER the postback (ASP.NET AJAX pattern:
  // the select gets cleared first, then re-populated)
  await page.waitForFunction(
    (sel, minCount) => {
      const el = document.querySelector(sel);
      return el && el.querySelectorAll("option").length >= minCount;
    },
    selectSelector,
    2, // need at least 2 options (placeholder + first real option)
    { timeout: 10000 }
  );

  const afterCount = await page.locator(selectSelector).first().locator("option").count();
  console.log(`    aspSelect: ${selectSelector} options populated=${afterCount}`);

  // NOW select the value (on the re-populated select)
  await page.locator(selectSelector).first().selectOption(value);
  console.log(`    aspSelect: selected value="${value}"`);
  await sleep;
  await page.waitForLoadState("domcontentloaded");
}

async function probe() {
  const results = {};
  const networkLog = [];
  let browser = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Capture ALL network requests
    page.on("request", (req) => {
      const url = req.url();
      networkLog.push({
        url,
        method: req.method(),
        postData: req.postData() ?? undefined,
        timestamp: Date.now(),
      });
    });

    let navigations = [];
    page.on("framenavigated", (frame) => {
      navigations.push({ url: frame.url(), ts: Date.now() });
    });

    // ── Step 1: Cold GET to RoRView.aspx ────────────────────────────────────

    console.log("\n[1/8] Cold GET to RoRView.aspx...");
    await page.goto("http://bhulekh.ori.nic.in/RoRView.aspx", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await sleep(800);

    const urlAfterCold = page.url();
    const titleAfterCold = await page.title();
    console.log(`    URL: ${urlAfterCold}`);
    console.log(`    Title: ${titleAfterCold}`);
    results.step1 = { url: urlAfterCold, title: titleAfterCold };

    // ── Step 2: Bootstrap via BhulekhError.aspx "here" ──────────────────────

    console.log("\n[2/8] Following bootstrap via BhulekhError.aspx...");
    if (page.url().includes("BhulekhError")) {
      console.log("    Confirmed: redirected to BhulekhError.aspx");
      const hereLink = page.locator('a:has-text("here")').first();
      const hereHref = await hereLink.getAttribute("href");
      console.log(`    'here' link href: ${hereHref}`);
      results.step2_href = hereHref;

      await hereLink.click();
      await sleep;
      await page.waitForLoadState("domcontentloaded");
    }

    const urlAfterBootstrap = page.url();
    console.log(`    URL after bootstrap: ${urlAfterBootstrap}`);
    results.step2 = { url: urlAfterBootstrap };

    // ── Step 3: Select district 20 ─────────────────────────────────────────

    console.log("\n[3/8] Selecting district 20 (Khordha)...");
    const districtOptions = await page
      .locator("#ctl00_ContentPlaceHolder1_ddlDistrict option")
      .all();
    for (const opt of districtOptions) {
      const val = await opt.getAttribute("value");
      const text = await opt.textContent();
      console.log(`      district option: value="${val}" text="${text?.trim()}"`);
    }

    await aspSelect(
      page,
      "#ctl00_ContentPlaceHolder1_ddlDistrict",
      "20",
      "ctl00$ContentPlaceHolder1$ddlDistrict"
    );
    console.log("    District 20 selected");

    // ── Step 4: Select tahasil 2 ────────────────────────────────────────────

    console.log("\n[4/8] Selecting tahasil 2 (Bhubaneswar)...");
    const tahasilOptions = await page
      .locator("#ctl00_ContentPlaceHolder1_ddlTahsil option")
      .all();
    for (const opt of tahasilOptions) {
      const val = await opt.getAttribute("value");
      const text = await opt.textContent();
      console.log(`      tahasil option: value="${val}" text="${text?.trim()}"`);
    }

    await aspSelect(
      page,
      "#ctl00_ContentPlaceHolder1_ddlTahsil",
      "2",
      "ctl00$ContentPlaceHolder1$ddlTahsil"
    );
    console.log("    Tahasil 2 selected");

    // ── Step 5: Select village 105 (Mendhasala) ────────────────────────────

    console.log("\n[5/8] Selecting village 105 (Mendhasala/ମେଣ୍ଢାଶାଳ)...");
    const villageOptions = await page
      .locator("#ctl00_ContentPlaceHolder1_ddlVillage option")
      .all();
    for (const opt of villageOptions) {
      const val = await opt.getAttribute("value");
      const text = await opt.textContent();
      console.log(`      village option: value="${val}" text="${text?.trim()}"`);
    }

    await aspSelect(
      page,
      "#ctl00_ContentPlaceHolder1_ddlVillage",
      "105",
      "ctl00$ContentPlaceHolder1$ddlVillage"
    );
    console.log("    Village 105 selected");

    // ── Step 6: Select RI 11 ───────────────────────────────────────────────

    console.log("\n[6/8] Selecting RI 11 (Mendhasala)...");

    // Wait for RI dropdown to become enabled after village postback
    await page
      .locator("#ctl00_ContentPlaceHolder1_ddlRI:not([disabled])")
      .waitFor({ state: "visible", timeout: 8000 });
    await sleep(500);

    const riOptions = await page
      .locator("#ctl00_ContentPlaceHolder1_ddlRI option")
      .all();
    for (const opt of riOptions) {
      const val = await opt.getAttribute("value");
      const text = await opt.textContent();
      console.log(`      RI option: value="${val}" text="${text?.trim()}"`);
    }

    await aspSelect(
      page,
      "#ctl00_ContentPlaceHolder1_ddlRI",
      "11",
      "ctl00$ContentPlaceHolder1$ddlRI"
    );
    console.log("    RI 11 selected");

    // ── Step 7: Switch to "Plot" radio button ─────────────────────────────

    console.log("\n[7/8] Switching to Plot radio button...");

    const allRadios = await page.locator('input[type="radio"]').all();
    const radioInfo = [];
    for (const radio of allRadios) {
      const name = await radio.getAttribute("name");
      const value = await radio.getAttribute("value");
      const id = await radio.getAttribute("id");
      const checked = await radio.isChecked();
      const html = await radio.evaluate((el) => el.outerHTML);
      radioInfo.push({ name, value, id, checked, html });
      console.log(
        `    radio: name=${name} value=${value} id=${id} checked=${checked}`
      );
    }
    results.allRadios = radioInfo;

    // Find and click the Plot radio
    const plotRadio = page
      .locator('input[type="radio"][value="Plot"]')
      .first();
    if (await plotRadio.count() > 0) {
      const clickedVal = await plotRadio.getAttribute("value");
      await plotRadio.click();
      console.log(`    Clicked Plot radio (value=${clickedVal})`);
      results.plotRadioClicked = clickedVal;
    } else {
      // Fallback: click 2nd radio in rbtnRORSearchtype group
      const searchRadios = page.locator(
        'input[name*="rbtnRORSearchtype"]'
      );
      const count = await searchRadios.count();
      if (count >= 2) {
        await searchRadios.nth(1).click();
        const val = await searchRadios.nth(1).getAttribute("value");
        console.log(`    Clicked 2nd radio button (value=${val})`);
        results.plotRadioClicked = val;
      }
    }

    await sleep;
    await page.waitForLoadState("domcontentloaded");

    console.log(`    URL after Plot switch: ${page.url()}`);

    // ── Step 7b: Capture page state BEFORE plot selection ─────────────────

    console.log(
      "\n[7b] Capturing page state BEFORE plot selection from ddlBindData..."
    );

    // Check ddlBindData
    const ddlBindData = page.locator(
      "#ctl00_ContentPlaceHolder1_ddlBindData"
    );
    const ddlExists = (await ddlBindData.count()) > 0;
    console.log(`    ddlBindData exists: ${ddlExists}`);
    results.ddlBindDataExistsBefore = ddlExists;

    if (ddlExists) {
      const options = [];
      const optCount = await ddlBindData.locator("option").count();
      for (let i = 0; i < optCount; i++) {
        const val = await ddlBindData.locator("option").nth(i).getAttribute("value");
        const text = await ddlBindData.locator("option").nth(i).textContent();
        options.push({ value: val, text: text?.trim() });
      }
      console.log(
        `    ddlBindData options (${options.length} total):`
      );
      options.slice(0, 30).forEach((o) =>
        console.log(`      value="${o.value}" text="${o.text}"`)
      );
      if (options.length > 30)
        console.log(`      ... and ${options.length - 30} more`);
      results.ddlBindDataOptionsBefore = options;
    }

    // Capture all buttons
    const btnSelectors = [
      "input[type='submit']",
      "input[type='button']",
      "button",
      'input[type="image"]',
    ];
    const buttonsBefore = [];
    for (const sel of btnSelectors) {
      const btns = page.locator(sel);
      const cnt = await btns.count();
      for (let i = 0; i < cnt; i++) {
        const html = await btns.nth(i).evaluate((el) => el.outerHTML);
        const vis = await btns.nth(i).isVisible();
        const dis = await btns.nth(i).isDisabled();
        buttonsBefore.push({ sel, html, vis, dis });
      }
    }
    console.log("    Buttons before plot select:");
    buttonsBefore.forEach((b) =>
      console.log(`      [${b.sel}] ${b.html} vis=${b.vis} dis=${b.dis}`)
    );
    results.buttonsBeforePlotSelect = buttonsBefore;

    // Capture form info
    const formInfo = await page.evaluate(() => {
      const form = document.querySelector("form");
      if (!form) return null;
      const vs = form.querySelector("input[name='__VIEWSTATE']");
      const ev = form.querySelector("input[name='__EVENTVALIDATION']");
      return {
        action: form.getAttribute("action"),
        method: form.method,
        viewstate: vs ? vs.value?.slice(0, 80) + "..." : null,
        eventvalidation: ev ? ev.value?.slice(0, 80) + "..." : null,
      };
    });
    console.log("    Form info:", JSON.stringify(formInfo));
    results.formInfoBefore = formInfo;

    // Save HTML before
    const htmlPathBefore = path.join(__dirname, "bhulekh-html-before-plot.html");
    writeFileSync(htmlPathBefore, await page.content());
    console.log(`    HTML saved to: ${htmlPathBefore}`);
    results.htmlPathBefore = htmlPathBefore;

    // ── Step 8: Select plot from ddlBindData ────────────────────────────────

    console.log("\n[8/8] Selecting plot from ddlBindData...");

    // Capture network requests starting now
    networkLog.length = 0;
    const bhulekhRequestsBefore = [];

    page.on("request", (req) => {
      if (req.url().includes("bhulekh") || req.url().includes("nic.in")) {
        bhulekhRequestsBefore.push({
          url: req.url(),
          method: req.method(),
          postData: req.postData() ?? undefined,
          timestamp: Date.now(),
        });
      }
    });

    // Also capture dialogs
    page.on("dialog", async (dialog) => {
      console.log(`    [DIALOG] ${dialog.type()}: ${dialog.message()}`);
      results.dialog = { type: dialog.type(), message: dialog.message() };
      await dialog.accept();
    });

    if (ddlExists) {
      const allOpts = await ddlBindData.locator("option").all();
      const optValues = [];
      for (const opt of allOpts) {
        const v = await opt.getAttribute("value");
        const t = await opt.textContent();
        if (v) optValues.push({ value: v, text: t?.trim() });
      }
      console.log(`    All ddlBindData values: ${optValues.map((o) => o.value).join(", ")}`);

      // Try plot 128, else first non-empty value
      const targetValue = optValues.find((o) => o.value === "128")?.value
        ?? (optValues.length > 1 ? optValues[1].value : null);

      if (targetValue) {
        console.log(`    Selecting ddlBindData value: ${targetValue}`);
        results.selectedPlotValue = targetValue;

        // Use aspSelect helper for ddlBindData too
        await aspSelect(
          page,
          "#ctl00_ContentPlaceHolder1_ddlBindData",
          targetValue,
          "ctl00$ContentPlaceHolder1$ddlBindData"
        );
        console.log("    Selection made — waiting 3s to observe postback...");

        await sleep;
        await page.waitForLoadState("domcontentloaded");

        const urlAfter = page.url();
        const navsAfter = [...navigations];
        console.log(`    URL after plot select: ${urlAfter}`);
        console.log(`    Total navigations: ${navsAfter.length}`);
        results.urlAfterPlotSelect = urlAfter;
        results.navigations = navsAfter;

      } else {
        console.log("    No valid plot values found in ddlBindData");
      }
    } else {
      console.log("    ddlBindData not found!");
    }

    // ── Capture state AFTER plot selection ─────────────────────────────────

    const htmlPathAfter = path.join(__dirname, "bhulekh-html-after-plot.html");
    writeFileSync(htmlPathAfter, await page.content());
    console.log(`    HTML saved to: ${htmlPathAfter}`);
    results.htmlPathAfter = htmlPathAfter;

    // Check for new elements
    const tableCount = await page.locator("table").count();
    console.log(`    Tables on page: ${tableCount}`);

    const gridView = page.locator("[id*=grdView]");
    console.log(`    GridView elements: ${await gridView.count()}`);

    const panelRor = page.locator("[id*=pnlDisplay]");
    console.log(`    Display panels: ${await panelRor.count()}`);

    // Buttons after
    const buttonsAfter = [];
    for (const sel of btnSelectors) {
      const btns = page.locator(sel);
      const cnt = await btns.count();
      for (let i = 0; i < cnt; i++) {
        const html = await btns.nth(i).evaluate((el) => el.outerHTML);
        const vis = await btns.nth(i).isVisible();
        const dis = await btns.nth(i).isDisabled();
        buttonsAfter.push({ sel, html, vis, dis });
      }
    }
    console.log("    Buttons after plot select:");
    buttonsAfter.forEach((b) =>
      console.log(`      [${b.sel}] ${b.html} vis=${b.vis} dis=${b.dis}`)
    );
    results.buttonsAfterPlotSelect = buttonsAfter;

    // Body text
    const bodyText = await page.locator("body").textContent();
    console.log(`\n    Body text (first 800 chars):\n    ${bodyText?.slice(0, 800)}`);

    // Network requests (bhulekh only)
    const bhulekhNet = bhulekhRequestsBefore.filter(
      (r) => r.url.includes("bhulekh") || r.url.includes("nic.in")
    );
    console.log(`\n    Network requests (bhulekh, ${bhulekhNet.length} total):`);
    bhulekhNet.forEach((r) => {
      console.log(`      ${r.method} ${r.url.slice(0, 120)}`);
      if (r.postData) console.log(`        POST: ${r.postData.slice(0, 300)}`);
    });
    results.networkRequests = bhulekhNet;

    // Form info after
    const formInfoAfter = await page.evaluate(() => {
      const form = document.querySelector("form");
      if (!form) return null;
      const vs = form.querySelector("input[name='__VIEWSTATE']");
      const ev = form.querySelector("input[name='__EVENTVALIDATION']");
      return {
        action: form.getAttribute("action"),
        method: form.method,
        viewstate: vs ? vs.value?.slice(0, 80) + "..." : null,
        eventvalidation: ev ? ev.value?.slice(0, 80) + "..." : null,
      };
    });
    console.log("    Form info after:", JSON.stringify(formInfoAfter));
    results.formInfoAfter = formInfoAfter;

    // ddlBindData options after
    if (ddlExists) {
      const optsAfter = [];
      const cntAfter = await ddlBindData.locator("option").count();
      for (let i = 0; i < cntAfter; i++) {
        const val = await ddlBindData.locator("option").nth(i).getAttribute("value");
        const txt = await ddlBindData.locator("option").nth(i).textContent();
        optsAfter.push({ value: val, text: txt?.trim() });
      }
      results.ddlBindDataOptionsAfter = optsAfter;
      console.log(
        `    ddlBindData count: before=${results.ddlBindDataOptionsBefore?.length ?? 0}, after=${optsAfter.length}`
      );
    }

    // Save results
    const resultsPath = path.join(
      __dirname,
      "bhulekh-ddlbinddata-probe-results.json"
    );
    writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n    Results JSON: ${resultsPath}`);

    console.log("\n=== PROBE COMPLETE ===");
    console.log(`HTML before: ${htmlPathBefore}`);
    console.log(`HTML after:  ${htmlPathAfter}`);
    console.log(`Network requests: ${bhulekhNet.length}`);
    console.log(`Navigations: ${navigations.length}`);

  } catch (err) {
    console.error("Probe error:", err);
    results.error = String(err);
    const resultsPath = path.join(
      __dirname,
      "bhulekh-ddlbinddata-probe-results.json"
    );
    writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  } finally {
    if (browser) await browser.close();
  }
}

probe();
