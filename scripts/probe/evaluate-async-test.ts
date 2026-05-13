/**
 * Probe: test async page.evaluate inside bhulekh context
 * Run: npx tsx scripts/probe/evaluate-async-test.ts
 */

import { chromium } from "playwright";

const BHULEKH_URL = "https://bhulekh.ori.nic.in";
const TIMEOUT_MS = 30_000;

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Bootstrap
    await page.goto(`${BHULEKH_URL}/RoRView.aspx`, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT_MS,
    });
    if (page.url().includes("BhulekhError.aspx")) {
      await page.locator("a", { hasText: "here" }).click();
      await page.waitForURL(/RoRView\.aspx/, { timeout: TIMEOUT_MS });
    }
    console.log("1. Bootstrap OK");

    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", "20");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", "2");
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => {
      const el = document.querySelector("#ctl00_ContentPlaceHolder1_ddlVillage") as HTMLSelectElement | null;
      return !!el && el.options.length > 1;
    }, { timeout: 15_000 });
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", "105");
    await page.waitForFunction(() => {
      const radio = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0");
      return !!radio && !radio.disabled;
    }, { timeout: 15_000 });
    console.log("2. Location selected OK");

    // TEST 1: Simple async page.evaluate
    console.log("3. Testing simple async page.evaluate...");
    try {
      const result = await page.evaluate(async () => {
        return "hello";
      });
      console.log("   SUCCESS:", result);
    } catch (e: any) {
      console.log("   FAILED:", e.message);
    }

    // TEST 2: page.evaluate with FormData and fetch (like postDeltaRaw)
    console.log("4. Testing page.evaluate with FormData + fetch...");
    try {
      const delta = await page.evaluate(async (params) => {
        const form = document.forms[0];
        const formData = new FormData(form);
        const parts: string[] = [];
        formData.forEach((value, key) => {
          parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        });
        parts.push(`${encodeURIComponent("ctl00$ContentPlaceHolder1$rbtnRORSearchtype")}=${encodeURIComponent(params.mode)}`);
        parts.push(`${encodeURIComponent("ctl00$ScriptManager1")}=${encodeURIComponent(`ctl00$ContentPlaceHolder1$UpdatePanel1|${params.eventTarget}`)}`);
        parts.push(`${encodeURIComponent("__EVENTTARGET")}=${encodeURIComponent(params.eventTarget)}`);
        parts.push(`${encodeURIComponent("__EVENTARGUMENT")}=`);
        const body = parts.join("&");
        const response = await window.fetch(window.location.href, {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "x-microsoftajax": "Delta=true",
            "x-requested-with": "XMLHttpRequest",
          },
          body: body,
          credentials: "include",
        });
        return response.text();
      }, { mode: "Plot", eventTarget: "ctl00$ContentPlaceHolder1$rbtnRORSearchtype$1" });
      const hasRedirect = delta.includes("pageRedirect");
      console.log("   SUCCESS, has pageRedirect:", hasRedirect);
      if (!hasRedirect) console.log("   First 200:", delta.slice(0, 200));
    } catch (e: any) {
      console.log("   FAILED:", e.message);
    }

    // TEST 3: Using page.$$eval with same code (to see if $$eval is different)
    console.log("5. Testing page.$$eval with FormData...");
    try {
      const fd = await page.$$eval("form", (forms) => {
        const form = forms[0];
        if (!form) return {};
        const formData = new FormData(form);
        const obj: Record<string, string> = {};
        formData.forEach((v, k) => { obj[k] = String(v); });
        return obj;
      });
      console.log("   SUCCESS, keys:", Object.keys(fd).length);
    } catch (e: any) {
      console.log("   FAILED:", e.message);
    }

    // Wait for Plot dropdown
    await page.waitForTimeout(800);

    // TEST 4: Try reading plot options
    console.log("6. Testing page.evaluate for plot options (sync)...");
    try {
      const opts = await page.evaluate(() => {
        const sel = document.querySelector("#ctl00_ContentPlaceHolder1_ddlBindData") as HTMLSelectElement;
        if (!sel) return [];
        return Array.from(sel.options).slice(0, 3).map(n => ({ value: n.value, text: n.textContent }));
      });
      console.log("   SUCCESS:", opts);
    } catch (e: any) {
      console.log("   FAILED:", e.message);
    }

    // TEST 5: Full View RoR flow using page.evaluate for form data + fetch
    console.log("7. Testing full View RoR flow (page.evaluate + fetch)...");
    try {
      const plotVal = "128";
      const formData = await page.evaluate(() => {
        const form = document.forms[0];
        if (!form) return {};
        const fd = new FormData(form);
        const obj: Record<string, string> = {};
        fd.forEach((v, k) => { obj[k] = String(v); });
        return obj;
      });
      console.log("   Got form data, keys:", Object.keys(formData).length);

      // Make sure the ddlBindData has our plot
      formData["ctl00$ContentPlaceHolder1$ddlBindData"] = plotVal;

      const delta2 = await page.evaluate(async (params) => {
        const parts: string[] = [];
        for (const [key, value] of Object.entries(params.formData)) {
          parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        }
        parts.push(`${encodeURIComponent("ctl00$ContentPlaceHolder1$rbtnRORSearchtype")}=${encodeURIComponent(params.mode)}`);
        parts.push(`${encodeURIComponent("ctl00$ScriptManager1")}=${encodeURIComponent(`ctl00$ContentPlaceHolder1$UpdatePanel1|${params.eventTarget}`)}`);
        parts.push(`${encodeURIComponent("__EVENTTARGET")}=${encodeURIComponent(params.eventTarget)}`);
        parts.push(`${encodeURIComponent("__EVENTARGUMENT")}=`);
        parts.push(`${encodeURIComponent("ctl00$ContentPlaceHolder1$ddlBindData")}=${encodeURIComponent(params.selectedValue)}`);
        parts.push(`${encodeURIComponent("ctl00$ContentPlaceHolder1$btnRORFront")}=${encodeURIComponent("View RoR")}`);
        const body = parts.join("&");
        const response = await window.fetch(window.location.href, {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "x-microsoftajax": "Delta=true",
            "x-requested-with": "XMLHttpRequest",
          },
          body: body,
          credentials: "include",
        });
        return response.text();
      }, {
        mode: "Plot",
        eventTarget: "ctl00$ContentPlaceHolder1$btnRORFront",
        selectedValue: plotVal,
        formData: formData,
      });
      const hasRedirect2 = delta2.includes("pageRedirect");
      console.log("   Result has pageRedirect:", hasRedirect2);
      if (hasRedirect2) {
        const match = delta2.match(/pageRedirect\|\|([^|]+)\|/);
        console.log("   Redirect path:", match?.[1]);
      }
    } catch (e: any) {
      console.log("   FAILED:", e.message);
    }

    console.log("\n=== DONE ===");
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
