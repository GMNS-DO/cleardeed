#!/usr/bin/env npx tsx
/**
 * Intercepts the actual View RoR POST from the browser to see exact format.
 * Run: pnpm dlx tsx scripts/probe-bhulekh-intercept-viewror.ts
 */
import { chromium } from "playwright";
import { writeFileSync } from "fs";
import path from "path";

const ROR_VIEW = "https://bhulekh.ori.nic.in/RoRView.aspx";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setExtraHTTPHeaders({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  });

  // Intercept ALL requests to Bhulekh
  const capturedRequests: { url: string; method: string; headers: Record<string, string>; body: string }[] = [];
  page.on("request", (req) => {
    if (!req.url().includes("bhulekh")) return;
    capturedRequests.push({
      url: req.url(),
      method: req.method(),
      headers: req.headers(),
      body: req.postData() ?? "",
    });
  });

  // Bootstrap
  await page.goto(ROR_VIEW, { waitUntil: "domcontentloaded", timeout: 30_000 });
  if (page.url().includes("BhulekhError.aspx")) {
    await page.locator("a", { hasText: "here" }).click();
    await page.waitForURL(/RoRView\.aspx/, { timeout: 30_000 });
  }

  // District
  await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", "20");
  await page.waitForFunction(() => {
    const el = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlTahsil");
    return !!el && el.options.length > 1;
  }, { timeout: 15_000 });

  // Tahasil
  await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", "2");
  await page.waitForFunction(() => {
    const el = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlVillage");
    return !!el && el.options.length > 1;
  }, { timeout: 15_000 });

  // Village
  await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", "105");
  await page.waitForFunction(() => {
    const el = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_rbtnRORSearchtype_0");
    return !!el && !el.disabled;
  }, { timeout: 15_000 });

  // Plot mode
  await page.locator('input[name="ctl00$ContentPlaceHolder1$rbtnRORSearchtype"][value="Plot"]').click();
  await page.waitForFunction(() => {
    const el = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
    return !!el && el.options.length > 1;
  }, { timeout: 15_000 });

  // Select plot 128
  const plotValue = await page.evaluate(() => {
    const sel = document.querySelector<HTMLSelectElement>("#ctl00_ContentPlaceHolder1_ddlBindData");
    if (!sel) return null;
    for (const opt of sel.options) {
      if (opt.textContent?.trim() === "128") return opt.value.trim();
    }
    return null;
  });
  console.log("Plot 128 value:", plotValue);

  if (!plotValue) {
    console.log("Plot 128 not found!");
    await browser.close();
    return;
  }

  await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", plotValue);

  // Wait for radios to be enabled
  await page.waitForFunction(() => {
    const btn = document.querySelector<HTMLInputElement>("#ctl00_ContentPlaceHolder1_btnRORFront");
    return !!btn && !btn.disabled;
  }, { timeout: 15_000 });

  // Read all hidden fields before clicking View RoR
  const hiddenBefore = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="hidden"]'));
    return inputs.map(n => ({ name: n.name, value: n.value.slice(0, 50) }));
  });
  console.log("\nHidden fields before View RoR:", hiddenBefore.map(h => h.name).join(", "));

  // Wait for the View RoR POST request
  console.log("\nClicking View RoR (intercepting)...");
  await page.locator("#ctl00_ContentPlaceHolder1_btnRORFront").click();
  const viewRorRequest = await page.waitForRequest(
    (req) => req.url().includes("RoRView") && (req.postData()?.includes("btnRORFront") || req.postData()?.includes("ctl00")),
    { timeout: 30_000 }
  );

  console.log("SUCCESS! URL:", page.url());

  // Save the captured View RoR request
  if (viewRorRequest) {
    console.log("\n--- CAPTURED VIEW ROR REQUEST ---");
    console.log("URL:", viewRorRequest.url);
    console.log("Method:", viewRorRequest.method);
    console.log("Headers:", JSON.stringify(viewRorRequest.headers, null, 2));
    // Parse and pretty-print body
    const bodyParams = new URLSearchParams(viewRorRequest.body);
    console.log("Body keys:", [...bodyParams.keys()].join(", "));
    for (const [k, v] of bodyParams) {
      if (k.includes("VIEWSTATE") || k.includes("EVENTVALIDATION")) {
        console.log(`  ${k}: [${v.length} chars]`);
      } else if (k.includes("btnRORFront")) {
        console.log(`  ${k}: "${decodeURIComponent(v)}"`);
      } else {
        console.log(`  ${k}: "${decodeURIComponent(v).slice(0, 80)}"`);
      }
    }
    writeFileSync(
      path.join(process.cwd(), "scripts", "probe", "bhulekh-viewror-request.json"),
      JSON.stringify(viewRorRequest, null, 2)
    );
    console.log("\nSaved to scripts/probe/bhulekh-viewror-request.json");
  } else {
    console.log("View RoR request not intercepted! Saving all captured requests...");
    const rorRequests = capturedRequests.filter(r => r.url.includes("RoRView"));
    writeFileSync(
      path.join(process.cwd(), "scripts", "probe", "bhulekh-all-ror-requests.json"),
      JSON.stringify(rorRequests, null, 2)
    );
  }

  // Save page HTML
  const html = await page.content();
  writeFileSync(path.join(process.cwd(), "scripts", "probe", "bhulekh-sror-playwright-plot128.html"), html);
  console.log("RoR page saved:", html.length, "chars");

  await browser.close();
}

main().catch(console.error);
