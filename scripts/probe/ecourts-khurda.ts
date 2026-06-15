/**
 * scripts/probe/ecourts-khurda.ts
 * Submit a real party-name search on Khurda dCourts and parse results.
 */
import { chromium } from "playwright";
import { execSync } from "child_process";
import { writeFileSync } from "fs";

const SEARCH_URL = "https://khurda.dcourts.gov.in/case-status-search-by-petitioner-respondent/";
const PARTY_NAME = "Deeksha Mahapatra";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(30_000);
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log(`[console-error] ${msg.text()}`);
  });
  page.on("response", async (resp) => {
    const url = resp.url();
    if (url.includes("admin-ajax") || url.includes("get_parties") || resp.status() >= 400) {
      console.log(`[net] ${resp.status()} ${url.slice(0, 120)}`);
    }
  });

  console.log(`[probe] going to ${SEARCH_URL}`);
  await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded" });

  await page.waitForFunction(
    () => document.querySelectorAll("#est_code option").length > 1,
    { timeout: 15_000 }
  );

  // Use Bhubaneswar complex (the main one for Khordha)
  await page.selectOption("#est_code", "ODKH01,ODKH03,ODKH02");
  console.log("[probe] selected: Court Complex, Bhubaneswar");

  // Case Status = Both (pending + disposed)
  await page.click("#chkBothStatus");
  console.log("[probe] selected case status: Both");

  // Year is required
  await page.fill("#reg_year", "2024");
  console.log("[probe] filled year: 2024");

  // Don't touch service_type — leave it at "Court Complex" (default)

  // Fill party name
  await page.fill("#litigant_name", PARTY_NAME);
  console.log(`[probe] filled party name: ${PARTY_NAME}`);

  // Get the captcha image and OCR it with ddddocr via Python
  const captchaImg = page.locator("#siwp_captcha_image_0");
  const captchaSrc = await captchaImg.getAttribute("src");
  console.log(`[probe] captcha src: ${captchaSrc?.slice(0, 80)}`);

  if (!captchaSrc) {
    console.log("[probe] no captcha image found");
    await browser.close();
    return;
  }

  // Fetch the captcha image
  const imgResponse = await page.request.get(captchaSrc);
  const imgBuffer = await imgResponse.body();
  const imgPath = "/tmp/khurda-captcha.png";
  writeFileSync(imgPath, imgBuffer);
  console.log(`[probe] captcha image saved (${imgBuffer.length} bytes)`);

  // Run ddddocr via Python
  let captchaText = "";
  try {
    captchaText = execSync(
      `python3 -c "import ddddocr,re; ocr = ddddocr.DdddOcr(show_ad=False); r = ocr.classification(open('${imgPath}', 'rb').read()); print(re.sub(r'[^A-Za-z0-9]', '', r))" 2>/dev/null`,
      { encoding: "utf-8" }
    ).trim();
    console.log(`[probe] ddddocr result: '${captchaText}'`);
  } catch (err: any) {
    console.log(`[probe] ddddocr error: ${err.message?.slice(0, 200)}`);
  }

  if (captchaText) {
    await page.fill("#siwp_captcha_value_0", captchaText);
    console.log(`[probe] filled captcha: ${captchaText}`);
  }

  // Re-fetch the captcha at submit time and save
  const captchaSrc2 = await page.locator("#siwp_captcha_image_0").getAttribute("src");
  if (captchaSrc2) {
    const imgResp2 = await page.request.get(captchaSrc2);
    const fs = await import("fs");
    fs.writeFileSync("/tmp/khurda-captcha-at-submit.png", await imgResp2.body());
    console.log(`[probe] captcha-at-submit saved (id=${captchaSrc2.match(/id=([^&]+)/)?.[1]})`);
  }

  // Submit
  await page.click("input[name='submit']");
  await page.waitForTimeout(5000);

  // Check result
  const resultText = await page.$eval("#cnrResults", (el) => el.innerText).catch(() => "(no #cnrResults)");
  const resultHtml = await page.$eval("#cnrResults", (el) => el.innerHTML).catch(() => "(no #cnrResults)");
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log(`\n[probe] === RESULT TEXT ===\n${resultText.slice(0, 1000)}`);
  console.log(`\n[probe] result html length: ${resultHtml.length}`);
  console.log(`\n[probe] === BODY (last 800 chars) ===\n${bodyText.slice(-800)}`);

  // Check for captcha error or no-records or results
  if (resultText.toLowerCase().includes("captcha") || resultText.toLowerCase().includes("invalid")) {
    console.log("\n[probe] === CAPTCHA REJECTED ===");
  } else if (resultText.toLowerCase().includes("nothing") || resultText.toLowerCase().includes("no record")) {
    console.log("\n[probe] === NO RECORDS FOUND (success path) ===");
  } else if (resultHtml.includes("<table") || resultHtml.includes("case_no") || resultHtml.includes("td")) {
    console.log("\n[probe] === RESULTS TABLE FOUND ===");
  } else {
    console.log("\n[probe] === UNKNOWN RESPONSE ===");
  }

  await page.screenshot({ path: "scripts/probe/ecourts-khurda-result.png", fullPage: true });

  await browser.close();
}

main().catch((err) => {
  console.error("[probe] unhandled:", err);
  process.exit(1);
});
