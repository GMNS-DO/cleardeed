/**
 * Bhulekh RoRView.aspx post-plot-selection probe
 *
 * Goal: Find the exact action (button? postback? AJAX?) that triggers the RoR
 * after the user selects a plot number from ddlBindData.
 *
 * Strategy:
 * 1. Follow the bootstrap: cold GET -> BhulekhError.aspx -> click "here"
 * 2. Select: district 20, tahasil 2, village 105 (Mendhasala), RI 11
 * 3. Switch to "Plot" radio button
 * 4. Capture ALL network requests from plot selection onward
 * 5. Capture HTML before plot selection (village selected + Plot mode)
 * 6. Capture HTML after plot selection
 * 7. Observe: automatic postback? New page load? Button appears?
 */

import { chromium, type Browser, type Page } from "playwright";
import { writeFileSync } from "fs";
import path from "path";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function captureNetwork(
  page: Page,
  label: string
): Promise<void> {
  const requests: Array<{
    url: string;
    method: string;
    postData?: string;
    responseUrl: string;
    status: number;
  }> = [];

  page.on("request", (req) => {
    const url = req.url();
    // Only capture requests to bhulekh.ori.nic.in or nearby
    if (url.includes("bhulekh") || url.includes("nic.in")) {
      requests.push({
        url: req.url(),
        method: req.method(),
        postData: req.postData() ?? undefined,
        responseUrl: req.response()?.url() ?? "",
        status: req.response()?.status() ?? 0,
      });
    }
  });

  await page.waitForTimeout(500);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Probe ──────────────────────────────────────────────────────────────────────

async function probe(): Promise<void> {
  const results: Record<string, unknown> = {};
  const networkLog: Array<{
    step: string;
    url: string;
    method: string;
    postData?: string;
    status: number;
  }> = [];

  const requests: Map<string, { method: string; postData?: string; status: number }> = new Map();

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // ── Network interception helper ──────────────────────────────────────────

    function onRequest(req: import("playwright").Request) {
      const url = req.url();
      if (url.includes("bhulekh") || url.includes("nic.in")) {
        networkLog.push({
          step: "pending-capture",
          url: req.url(),
          method: req.method(),
          postData: req.postData() ?? undefined,
          status: req.response()?.status() ?? 0,
        });
        requests.set(url, {
          method: req.method(),
          postData: req.postData() ?? undefined,
          status: req.response()?.status() ?? 0,
        });
      }
    }

    page.on("request", onRequest);

    // ── Step 1: Cold GET to RoRView.aspx ──────────────────────────────────

    console.log("\n[1/8] Cold GET to RoRView.aspx...");
    await page.goto("http://bhulekh.ori.nic.in/RoRView.aspx", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await sleep;

    const urlAfterCold = page.url();
    const titleAfterCold = await page.title();
    console.log(`    URL: ${urlAfterCold}`);
    console.log(`    Title: ${titleAfterCold}`);
    results.step1 = { url: urlAfterCold, title: titleAfterCold };

    // ── Step 2: Bootstrap via BhulekhError.aspx "here" ────────────────────

    console.log("\n[2/8] Following bootstrap via BhulekhError.aspx...");
    const url2 = page.url();
    if (url2.includes("BhulekhError")) {
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

    // ── Step 3: Select district 20 ──────────────────────────────────────────

    console.log("\n[3/8] Selecting district 20 (Khordha)...");

    // Wait for district dropdown to appear
    const districtSelect = page.locator("#ctl00_ContentPlaceHolder1_ddlDistrict, #ddlDistrict").first();
    await districtSelect.waitFor({ state: "visible", timeout: 10000 });
    await sleep(500);

    await districtSelect.selectOption("20");
    await sleep;
    await page.waitForLoadState("domcontentloaded");
    console.log("    District 20 selected");

    // ── Step 4: Select tahasil 2 ────────────────────────────────────────────

    console.log("\n[4/8] Selecting tahasil 2 (Bhubaneswar)...");
    const tahasilSelect = page.locator("#ddlTahsil, #ctl00_ContentPlaceHolder1_ddlTahsil").first();
    await tahasilSelect.waitFor({ state: "visible", timeout: 10000 });
    await sleep(500);

    await tahasilSelect.selectOption("2");
    await sleep;
    await page.waitForLoadState("domcontentloaded");
    console.log("    Tahasil 2 selected");

    // ── Step 5: Select village 105 (Mendhasala) ────────────────────────────

    console.log("\n[5/8] Selecting village 105 (Mendhasala/ମେଣ୍ଢାଶାଳ)...");
    const villageSelect = page.locator("#ddlVillage, #ctl00_ContentPlaceHolder1_ddlVillage").first();
    await villageSelect.waitFor({ state: "visible", timeout: 10000 });
    await sleep(500);

    await villageSelect.selectOption("105");
    await sleep;
    await page.waitForLoadState("domcontentloaded");
    console.log("    Village 105 selected");

    // ── Step 6: Select RI 11 ────────────────────────────────────────────────

    console.log("\n[6/8] Selecting RI 11...");
    const riSelect = page.locator("#ddlRI, #ctl00_ContentPlaceHolder1_ddlRI").first();
    await riSelect.waitFor({ state: "visible", timeout: 10000 });
    await sleep(500);

    await riSelect.selectOption("11");
    await sleep;
    await page.waitForLoadState("domcontentloaded");
    console.log("    RI 11 selected");

    // ── Step 7: Switch to "Plot" radio ─────────────────────────────────────

    console.log("\n[7/8] Switching to Plot radio button...");

    const plotRadios = page.locator('input[name*="rbtnRORSearchtype"], input[type="radio"]');
    const radioCount = await plotRadios.count();
    console.log(`    Found ${radioCount} radio inputs on page`);

    // Try to find the Plot radio specifically
    const allRadios = page.locator('input[type="radio"]');
    const allRadioHtml: string[] = [];
    const count = await allRadios.count();
    for (let i = 0; i < count; i++) {
      const html = await allRadios.nth(i).evaluate((el: Element) => el.outerHTML);
      allRadioHtml.push(html);
    }
    console.log("    All radio inputs:");
    allRadioHtml.forEach((html, i) => console.log(`      [${i}] ${html}`));
    results.allRadios = allRadioHtml;

    // Try clicking Plot radio
    const plotRadio = page.locator('input[name*="rbtnRORSearchtype"][value="Plot"], input[name*="rbtnRORSearchtype"]').first();
    const plotRadioCount = await plotRadio.count();
    console.log(`    Plot radio count: ${plotRadioCount}`);

    if (plotRadioCount > 0) {
      await plotRadio.click();
      console.log("    Clicked Plot radio");
    } else {
      // Fallback: find by value or label text
      const radioByValue = page.locator('input[type="radio"][value="Plot"]');
      if (await radioByValue.count() > 0) {
        await radioByValue.click();
        console.log("    Clicked Plot radio (by value=Plot)");
      } else {
        // Find all radio buttons and try to click the second one (first is usually Khatiyan)
        const radios = page.locator('input[name*="rbtnRORSearchtype"]');
        const rCount = await radios.count();
        if (rCount >= 2) {
          await radios.nth(1).click();
          console.log("    Clicked second radio button (Plot)");
        }
      }
    }

    await sleep;
    await page.waitForLoadState("domcontentloaded");

    const urlAfterPlotSwitch = page.url();
    console.log(`    URL after Plot switch: ${urlAfterPlotSwitch}`);

    // ── Capture HTML BEFORE plot selection from ddlBindData ─────────────────

    console.log("\n[7b] Capturing page HTML BEFORE plot selection...");

    // Check if ddlBindData exists
    const ddlBindData = page.locator("#ctl00_ContentPlaceHolder1_ddlBindData, #ddlBindData").first();
    const ddlBindDataExists = await ddlBindData.count() > 0;
    console.log(`    ddlBindData exists: ${ddlBindDataExists}`);

    if (ddlBindDataExists) {
      const options: string[] = [];
      const optionCount = await ddlBindData.locator("option").count();
      for (let i = 0; i < optionCount; i++) {
        const val = await ddlBindData.locator("option").nth(i).getAttribute("value");
        const text = await ddlBindData.locator("option").nth(i).textContent();
        options.push(`value="${val}" text="${text?.trim()}"`);
      }
      console.log("    ddlBindData options (before plot select):");
      options.slice(0, 20).forEach((o) => console.log(`      ${o}`));
      results.ddlBindDataOptions_before = options;
    }

    // Look for any submit buttons on the page
    const buttons = page.locator("input[type='submit'], input[type='button'], button");
    const buttonHtml: string[] = [];
    const buttonCount = await buttons.count();
    for (let i = 0; i < buttonCount; i++) {
      const html = await buttons.nth(i).evaluate((el: Element) => el.outerHTML);
      buttonHtml.push(html);
    }
    console.log("    Buttons on page (before plot select):");
    buttonHtml.forEach((b) => console.log(`      ${b}`));
    results.buttonsBeforePlotSelect = buttonHtml;

    // Capture full page HTML for analysis
    const htmlBeforePlot = await page.content();
    const htmlPathBefore = path.join(__dirname, "bhulekh-html-before-plot.html");
    writeFileSync(htmlPathBefore, htmlBeforePlot);
    console.log(`    HTML saved to: ${htmlPathBefore}`);
    results.htmlPathBefore = htmlPathBefore;

    // ── Step 8: Select plot 128 from ddlBindData ────────────────────────────

    console.log("\n[8/8] Selecting plot 128 from ddlBindData...");

    // Clear previous network log
    networkLog.length = 0;

    // Start capturing with step labels
    function logRequest(req: import("playwright").Request) {
      const url = req.url();
      if (url.includes("bhulekh") || url.includes("nic.in")) {
        networkLog.push({
          step: "post-plot-select",
          url: req.url(),
          method: req.method(),
          postData: req.postData() ?? undefined,
          status: req.response()?.status() ?? 0,
        });
      }
    }

    page.on("request", logRequest);

    // Also listen for dialog/popup
    page.on("dialog", async (dialog) => {
      console.log(`    [DIALOG] ${dialog.type()}: ${dialog.message()}`);
      results.dialog = { type: dialog.type(), message: dialog.message() };
      await dialog.accept();
    });

    // Also listen for page navigation
    let newUrl: string | null = null;
    page.on("framenavigated", (frame) => {
      const url = frame.url();
      if (url !== urlAfterPlotSwitch) {
        newUrl = url;
        console.log(`    [NAVIGATION] New URL: ${url}`);
      }
    });

    // Try to select plot 128
    if (ddlBindDataExists) {
      const allOptions = await ddlBindData.locator("option").all();
      const optionValues: string[] = [];
      for (const opt of allOptions) {
        optionValues.push(await opt.getAttribute("value") ?? "");
      }
      console.log(`    Available plot values: ${optionValues.join(", ")}`);

      // Look for plot 128
      if (optionValues.includes("128")) {
        await ddlBindData.selectOption("128");
        console.log("    Selected plot 128");
      } else if (optionValues.length > 1) {
        // Try to select a value
        const firstValue = optionValues[1]; // First is usually empty/placeholder
        await ddlBindData.selectOption(firstValue);
        console.log(`    Selected first plot option: ${firstValue}`);
      }
    } else {
      console.log("    ddlBindData not found — cannot select plot");
    }

    // Wait to observe what happens
    console.log("    Waiting 5 seconds for any postback/AJAX...");
    await sleep;
    await page.waitForLoadState("domcontentloaded");

    const urlAfterPlotSelect = page.url();
    console.log(`    URL after plot select: ${urlAfterPlotSelect}`);

    // Capture network log
    results.networkLog = networkLog;
    console.log(`    Network requests captured: ${networkLog.length}`);

    // ── Capture HTML AFTER plot selection ──────────────────────────────────

    const htmlAfterPlot = await page.content();
    const htmlPathAfter = path.join(__dirname, "bhulekh-html-after-plot.html");
    writeFileSync(htmlPathAfter, htmlAfterPlot);
    console.log(`    HTML saved to: ${htmlPathAfter}`);
    results.htmlPathAfter = htmlPathAfter;

    // Check if new elements appeared (RoR table, etc.)
    const tables = page.locator("table");
    const tableCount = await tables.count();
    console.log(`    Tables on page after plot select: ${tableCount}`);

    const gridView = page.locator("#ctl00_ContentPlaceHolder1_grdView, #grdView");
    const gridCount = await gridView.count();
    console.log(`    GridView (grdView) on page: ${gridCount}`);
    results.gridViewFound = gridCount > 0;

    const anyNewContent = await page.locator("body").textContent();
    const bodyTextSnippet = anyNewContent?.slice(0, 500) ?? "";
    console.log(`    Body text snippet (first 500 chars):\n    ${bodyTextSnippet}`);

    // Check for visible buttons (again, in case something appeared)
    const buttonsAfter = page.locator("input[type='submit'], input[type='button'], button");
    const buttonHtmlAfter: string[] = [];
    const buttonCountAfter = await buttonsAfter.count();
    for (let i = 0; i < buttonCountAfter; i++) {
      const html = await buttonsAfter.nth(i).evaluate((el: Element) => el.outerHTML);
      buttonHtmlAfter.push(html);
    }
    console.log("    Buttons on page (after plot select):");
    buttonHtmlAfter.forEach((b) => console.log(`      ${b}`));
    results.buttonsAfterPlotSelect = buttonHtmlAfter;

    // ── Save results ─────────────────────────────────────────────────────────

    const resultsPath = path.join(__dirname, "bhulekh-ddlbinddata-probe-results.json");
    writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n    Results saved to: ${resultsPath}`);

    console.log("\n=== PROBE COMPLETE ===");
    console.log(`HTML before plot select: ${htmlPathBefore}`);
    console.log(`HTML after plot select:  ${htmlPathAfter}`);
    console.log(`Network requests: ${networkLog.length}`);

  } finally {
    if (browser) await browser.close();
  }
}

probe().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
