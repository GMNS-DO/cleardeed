/**
 * Probe: Bhulekh ddlBindData trigger mechanism
 *
 * Objective: Find exactly what fires when user selects a plot from
 * ctl00_ContentPlaceHolder1_ddlBindData on RoRView.aspx.
 *
 * Run: npx tsx scripts/probe/bhulekh-ddlbinddata-probe.ts
 */

import { chromium, type Page, type Request } from "playwright";

const BHULEKH_URL = "https://bhulekh.ori.nic.in";
const ROR_VIEW_URL = `${BHULEKH_URL}/RoRView.aspx`;
const TIMEOUT_MS = 30_000;

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });

    console.log("=== STEP 1: Bootstrap public session ===");
    await page.goto(ROR_VIEW_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });

    if (page.url().includes("BhulekhError.aspx")) {
      console.log("Redirected to BhulekhError.aspx — clicking 'here'...");
      await page.locator("a", { hasText: "here" }).click();
      await page.waitForURL(/RoRView\.aspx/, { timeout: TIMEOUT_MS });
    }

    console.log(`Landed at: ${page.url()}`);

    // Collect all network requests from this point
    const allRequests: Request[] = [];
    page.on("request", (req) => {
      const url = req.url();
      // Filter to Bhulekh domain only
      if (url.includes("bhulekh")) {
        allRequests.push(req);
      }
    });

    console.log("\n=== STEP 2: Select district 20 ===");
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", "20");
    await page.waitForLoadState("networkidle");

    console.log("\n=== STEP 3: Select tahasil 2 ===");
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", "2");
    await page.waitForLoadState("networkidle");

    console.log("\n=== STEP 4: Select village 105 (Mendhasala) ===");
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", "105");
    await page.waitForLoadState("networkidle");

    // Wait for radio buttons to become enabled
    await page.waitForFunction(() => {
      const radio = document.querySelector<HTMLInputElement>(
        'input[type="radio"][id^="ctl00_ContentPlaceHolder1_rbtnRORSearchtype"]'
      );
      return !!radio && !radio.disabled;
    }, { timeout: 15_000 });

    console.log("\n=== STEP 5: Capture page HTML at village-selected state ===");
    const htmlBefore = await page.content();

    // Save page HTML to see current state
    const fs = await import("fs");
    fs.writeFileSync("/tmp/bhulekh-village-selected.html", htmlBefore);
    console.log("Saved village-selected HTML to /tmp/bhulekh-village-selected.html");

    // Check for visible buttons and their IDs
    const buttonsInfo = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button, input[type='submit'], input[type='button']"));
      return buttons.map(b => ({
        id: b.id || "(no id)",
        name: (b as HTMLInputElement).name || "(no name)",
        value: (b as HTMLInputElement).value || "(no value)",
        type: b.type,
        visible: b.offsetParent !== null,
        text: b.textContent?.trim() || "(no text)",
      }));
    });
    console.log("\nButtons found on page:");
    buttonsInfo.forEach(b => console.log(JSON.stringify(b)));

    // Check ddlBindData options before Plot mode
    const bindDataOptionsBefore = await page.locator("#ctl00_ContentPlaceHolder1_ddlBindData option").evaluateAll(
      nodes => nodes.map(n => ({ value: (n as HTMLOptionElement).value, text: n.textContent?.trim() }))
    );
    console.log(`\nddlBindData options (${bindDataOptionsBefore.length} total, first 10):`);
    bindDataOptionsBefore.slice(0, 10).forEach(o => console.log(`  value="${o.value}" text="${o.text}"`));

    console.log("\n=== STEP 6: Switch to Plot mode (click radio button) ===");

    // Clear previous requests from network log
    const requestsBeforePlot: Request[] = [...allRequests];

    // Click Plot radio button (index 1)
    const plotRadio = page.locator("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_1");
    await plotRadio.click();
    await page.waitForLoadState("networkidle");

    // Check for UpdatePanel updates (partial postback)
    const requestsAfterPlotClick = allRequests.slice(requestsBeforePlot.length);
    console.log(`\nNetwork requests during Plot mode switch: ${requestsAfterPlotClick.length}`);
    requestsAfterPlotClick.forEach(req => {
      console.log(`  [${req.method()}] ${req.url().replace(BHULEKH_URL, "")} (${req.resourceType()})`);
      const postData = req.postData();
      if (postData) {
        console.log(`    POST body (first 500 chars): ${postData.slice(0, 500)}`);
      }
    });

    // Check ddlBindData options after Plot mode
    const bindDataOptionsAfter = await page.locator("#ctl00_ContentPlaceHolder1_ddlBindData option").evaluateAll(
      nodes => nodes.map(n => ({ value: (n as HTMLOptionElement).value, text: n.textContent?.trim() }))
    );
    console.log(`\nddlBindData options after Plot mode (${bindDataOptionsAfter.length} total, first 20):`);
    bindDataOptionsAfter.slice(0, 20).forEach(o => console.log(`  value="${o.value}" text="${o.text}"`));

    // Find plot 128 option
    const plot128Option = bindDataOptionsAfter.find(o => o.text === "128" || o.text.includes("128"));
    if (plot128Option) {
      console.log(`\nFound plot 128: value="${plot128Option.value}" text="${plot128Option.text}"`);
    } else {
      console.log("\nPlot 128 not found in dropdown. Checking all...");
      bindDataOptionsAfter.forEach(o => {
        if (o.text.includes("12")) console.log(`  value="${o.value}" text="${o.text}"`);
      });
    }

    // === THE KEY PROBE: what happens when ddlBindData changes ===
    console.log("\n=== STEP 7: Capture network requests when ddlBindData selection changes ===");

    const requestsBeforeDdlChange: number = allRequests.length;

    if (plot128Option) {
      console.log(`Selecting ddlBindData option: value="${plot128Option.value}"`);

      // Option A: SelectOption (Playwright method)
      await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", plot128Option.value);
      await page.waitForLoadState("networkidle");

      const requestsAfterDdlChange = allRequests.slice(requestsBeforeDdlChange);
      console.log(`\nNetwork requests triggered by ddlBindData change: ${requestsAfterDdlChange.length}`);
      requestsAfterDdlChange.forEach(req => {
        console.log(`  [${req.method()}] ${req.url().replace(BHULEKH_URL, "")} (${req.resourceType()})`);
        const postData = req.postData();
        if (postData) {
          // Parse and pretty-print the POST body
          console.log(`    POST body: ${postData}`);
        }
        const response = req.response();
        if (response) {
          console.log(`    Response status: ${response.status()}, content-type: ${response.headers()["content-type"]}`);
        }
      });

      console.log("\n=== STEP 8: Check if a View RoR button appeared ===");
      const viewRoRButton = await page.locator("#ctl00_ContentPlaceHolder1_btnRORFront").isVisible().catch(() => false);
      console.log(`btnRORFront visible: ${viewRoRButton}`);

      const pageContentAfterDdl = await page.content();
      const fs2 = await import("fs");
      fs2.writeFileSync("/tmp/bhulekh-after-ddlchange.html", pageContentAfterDdl);
      console.log("Saved page HTML after ddlBindData change to /tmp/bhulekh-after-ddlchange.html");

      // Check for onchange handlers
      const ddlOnChange = await page.evaluate(() => {
        const ddl = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
        return ddl ? ddl.getAttribute("onchange") : null;
      });
      console.log(`\nddlBindData onchange handler: ${ddlOnChange || "(none)"}`);

      // Check for JavaScript in the page that might handle ddlBindData
      const jsHandlers = await page.evaluate(() => {
        const result: string[] = [];
        // Look for any script that mentions ddlBindData
        const scripts = document.querySelectorAll("script");
        scripts.forEach(script => {
          const text = script.textContent || "";
          if (text.includes("ddlBindData") || text.includes("btnRORFront")) {
            result.push(text.slice(0, 500));
          }
        });
        return result;
      });
      if (jsHandlers.length > 0) {
        console.log("\nJavaScript handlers related to ddlBindData found:");
        jsHandlers.forEach((h, i) => console.log(`  Handler ${i + 1}: ${h.slice(0, 300)}...`));
      }

      console.log("\n=== STEP 9: If btnRORFront visible, click it and capture final request ===");
      if (viewRoRButton) {
        const finalRequestsBefore: number = allRequests.length;
        console.log("Clicking btnRORFront (View RoR button)...");

        await page.locator("#ctl00_ContentPlaceHolder1_btnRORFront").click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout; // extra wait for any redirects

        const finalRequests = allRequests.slice(finalRequestsBefore);
        console.log(`\nNetwork requests during btnRORFront click: ${finalRequests.length}`);
        finalRequests.forEach(req => {
          console.log(`  [${req.method()}] ${req.url().replace(BHULEKH_URL, "")} (${req.resourceType()})`);
          const postData = req.postData();
          if (postData) {
            console.log(`    POST body: ${postData}`);
          }
        });

        console.log(`\nFinal URL after btnRORFront: ${page.url()}`);
      }
    } else {
      console.log("Plot 128 not found — trying first available option");
      if (bindDataOptionsAfter.length > 1) {
        const firstOption = bindDataOptionsAfter[1]; // skip "Select"
        console.log(`Selecting first non-select option: "${firstOption.text}"`);
        await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", firstOption.value);
        await page.waitForLoadState("networkidle");

        const requestsAfterDdlChange = allRequests.slice(requestsBeforeDdlChange);
        console.log(`\nNetwork requests triggered by ddlBindData change: ${requestsAfterDdlChange.length}`);
        requestsAfterDdlChange.forEach(req => {
          console.log(`  [${req.method()}] ${req.url().replace(BHULEKH_URL, "")} (${req.resourceType()})`);
          const postData = req.postData();
          if (postData) console.log(`    POST: ${postData}`);
        });
      }
    }

    // === Summary ===
    console.log("\n=== PROBE SUMMARY ===");
    const ddlRelatedRequests = allRequests.filter(r =>
      r.postData()?.includes("ddlBindData") ||
      r.url().includes("ddlBindData")
    );
    console.log(`Total Bhulekh network requests captured: ${allRequests.length}`);
    console.log(`Requests mentioning ddlBindData: ${ddlRelatedRequests.length}`);

    const xhrRequests = allRequests.filter(r => r.resourceType() === "xhr" || r.resourceType() === "fetch");
    console.log(`AJAX (xhr/fetch) requests: ${xhrRequests.length}`);

  } finally {
    await browser.close();
  }
}

run().catch(console.error);