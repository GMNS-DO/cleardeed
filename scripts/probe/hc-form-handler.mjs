import { chromium } from "playwright";
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

  // Inspect submit1 handler
  const handlerInfo = await page.evaluate(() => {
    const btn = document.querySelector('input[name="submit1"]');
    if (!btn) return { error: "no button" };
    // jQuery handler info
    const jqEvents = (window).jQuery ? (window).jQuery._data(btn, "events") : null;
    return {
      onclick: btn.getAttribute("onclick"),
      type: btn.type,
      formMethod: btn.form?.method,
      jqEventsCount: jqEvents ? Object.keys(jqEvents).length : 0,
      jqHandlers: jqEvents ? Object.entries(jqEvents).map(([k, v]) => ({ type: k, handlers: v.length })) : null,
    };
  });
  console.log("HANDLER INFO:", JSON.stringify(handlerInfo, null, 2));

  // Try the raw form.submit() path — bypasses button JS
  await page.focus("#petres_name");
  await page.waitForTimeout(500);
  // Solve captcha via canvas
  const captchaText = await page.evaluate(async () => {
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
  const { createWorker } = await import("tesseract.js");
  const w = await createWorker("eng");
  const { data } = await w.recognize(captchaText);
  await w.terminate();
  const cleaned = (data.text ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase().substring(0, 8);
  console.log(`OCR: "${cleaned}" conf=${data.confidence}`);

  await page.fill("#petres_name", PARTY);
  await page.fill("#captcha", cleaned);
  const both = await page.$('input[name="f"][value="Both"]');
  if (both) await both.check();

  // Try form.submit() direct
  await page.evaluate(() => {
    const f = document.querySelector("form");
    if (f) f.submit();
  });
  await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout;

  const url = page.url();
  const title = await page.title();
  const bodyText = (await page.evaluate(() => document.body?.innerText ?? "")).substring(0, 3000);
  const tables = await page.evaluate(() =>
    Array.from(document.querySelectorAll("table")).map((t) => ({ html: t.outerHTML.substring(0, 2000), len: t.outerHTML.length }))
  );

  console.log("FORM.SUBMIT() RESULT:", JSON.stringify({ url, title, tableCount: tables.length, bodyText, tableSamples: tables }, null, 2));

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
