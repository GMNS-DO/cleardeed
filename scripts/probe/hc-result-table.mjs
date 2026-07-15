import { chromium } from "playwright";
import { createWorker } from "tesseract.js";
import { writeFileSync } from "node:fs";

const BASE_URL = "https://hcservices.ecourts.gov.in/ecourtindiaHC";
const PARTY = "Mohapatra";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: "ClearDeed/1.0 (probe)" });
  const page = await ctx.newPage();
  await page.goto(
    `${BASE_URL}/cases/ki_petres.php?state_cd=11&dist_cd=1&court_code=1&stateNm=Odisha`,
    { waitUntil: "domcontentloaded", timeout: 30_000 }
  );
  await page.waitForTimeout(800);

  await page.focus("#petres_name");
  await page.waitForTimeout(500);

  const captchaDataUrl = await page.evaluate(async () => {
    const img = document.querySelector("#captcha_image");
    if (!img || !img.src) return null;
    const fresh = new Image();
    fresh.crossOrigin = "anonymous";
    fresh.src = img.src;
    await new Promise((res) => { fresh.onload = () => res(); fresh.onerror = () => res(); });
    const canvas = document.createElement("canvas");
    canvas.width = fresh.naturalWidth; canvas.height = fresh.naturalHeight;
    const ctx2 = canvas.getContext("2d");
    ctx2.drawImage(fresh, 0, 0);
    return canvas.toDataURL("image/png");
  });

  const w = await createWorker("eng");
  const { data } = await w.recognize(captchaDataUrl);
  await w.terminate();
  const cleaned = (data.text ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase().substring(0, 8);
  console.log(`OCR: "${cleaned}" conf=${data.confidence}`);

  await page.fill("#petres_name", PARTY);
  await page.fill("#captcha", cleaned);
  const both = await page.$('input[name="f"][value="Both"]');
  if (both) await both.check();

  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {}),
    page.evaluate(() => { const f = document.querySelector("form"); if (f) f.submit(); }),
  ]);
  await page.waitForTimeout;

  // Dump second table (result table)
  const resultTable = await page.evaluate(() => {
    const tables = document.querySelectorAll("table");
    if (tables.length < 2) return null;
    return tables[1].outerHTML;
  });
  writeFileSync("/tmp/hc-result-table.html", resultTable ?? "");
  console.log("RESULT TABLE LEN:", resultTable?.length);

  // Look for empty-data or error messages
  const resultSummary = await page.evaluate(() => {
    const txt = document.body?.innerText ?? "";
    return {
      hasNoRecords: /no\s*record|0\s*record|not\s*found|not\s*available/i.test(txt),
      hasInvalid: /invalid|captcha|try\s*again/i.test(txt),
      bodyLength: txt.length,
      showList: document.querySelector("#showList")?.innerHTML?.substring(0, 2000) ?? null,
    };
  });
  console.log("RESULT SUMMARY:", JSON.stringify(resultSummary, null, 2));

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
