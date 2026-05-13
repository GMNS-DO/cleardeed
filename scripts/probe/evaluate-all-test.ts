/**
 * Test Playwright evaluateAll vs page.evaluate in Bhulekh context
 * Run: npx tsx scripts/probe/evaluate-all-test.ts
 */

import { chromium } from "playwright";

const BHULEKH_URL = "https://bhulekh.ori.nic.in";
const TIMEOUT_MS = 30_000;

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Bootstrap session
    await page.goto(`${BHULEKH_URL}/RoRView.aspx`, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT_MS,
    });
    if (page.url().includes("BhulekhError.aspx")) {
      await page.locator("a", { hasText: "here" }).click();
      await page.waitForURL(/RoRView\.aspx/, { timeout: TIMEOUT_MS });
    }

    // Select district
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", "20");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Select tahasil
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", "2");
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => {
      const el = document.querySelector("#ctl00_ContentPlaceHolder1_ddlVillage") as HTMLSelectElement | null;
      return !!el && el.options.length > 1;
    }, { timeout: 15_000 });

    // Select village
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", "105");
    await page.waitForFunction(() => {
      const radio = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0");
      return !!radio && !radio.disabled;
    }, { timeout: 15_000 });

    // Switch to Plot mode via AJAX
    await page.evaluate(async () => {
      const form = document.forms[0] as HTMLFormElement;
      const fd = new FormData(form);
      const params = new URLSearchParams();
      fd.forEach((v, k) => params.append(k, String(v)));
      params.set("ctl00$ContentPlaceHolder1$rbtnRORSearchtype", "Plot");
      params.set("ctl00$ScriptManager1", "ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$rbtnRORSearchtype$1");
      params.set("__EVENTTARGET", "ctl00$ContentPlaceHolder1$rbtnRORSearchtype$1");
      params.set("__EVENTARGUMENT", "");
      await window.fetch(window.location.href, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "x-microsoftajax": "Delta=true",
          "x-requested-with": "XMLHttpRequest",
        },
        body: params.toString(),
        credentials: "include",
      });
    });

    await page.waitForTimeout;

    // Test 1: locator.evaluateAll
    console.log("=== Testing locator.evaluateAll ===");
    try {
      const opts1 = await page.locator("#ctl00_ContentPlaceHolder1_ddlBindData option").evaluateAll((nodes) => {
        return nodes.map((n) => ({
          value: (n as HTMLOptionElement).value,
          text: n.textContent?.trim() ?? "",
        }));
      });
      console.log("SUCCESS:", opts1.slice(0, 5));
    } catch (e: any) {
      console.log("FAILED:", e.message);
    }

    // Test 2: page.evaluate
    console.log("\n=== Testing page.evaluate ===");
    try {
      const opts2 = await page.evaluate(() => {
        const sel = document.querySelector("#ctl00_ContentPlaceHolder1_ddlBindData") as HTMLSelectElement;
        if (!sel) return [];
        return Array.from(sel.options).map((n) => ({
          value: n.value,
          text: n.textContent?.trim() ?? "",
        }));
      });
      console.log("SUCCESS:", opts2.slice(0, 5));
    } catch (e: any) {
      console.log("FAILED:", e.message);
    }

    // Test 3: locator.evaluateAll on the village dropdown (simpler, no AJAX)
    console.log("\n=== Testing locator.evaluateAll on village dropdown ===");
    try {
      const opts3 = await page.locator("#ctl00_ContentPlaceHolder1_ddlVillage option").evaluateAll((nodes) => {
        return nodes.map((n) => ({
          value: (n as HTMLOptionElement).value,
          text: n.textContent?.trim() ?? "",
        }));
      });
      console.log("SUCCESS:", opts3.slice(0, 5));
    } catch (e: any) {
      console.log("FAILED:", e.message);
    }

    console.log("\n=== DONE ===");
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
