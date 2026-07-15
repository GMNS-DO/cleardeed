import { chromium } from "playwright";
import { createWorker } from "tesseract.js";
import { writeFileSync } from "node:fs";

const BASE_URL = "https://hcservices.ecourts.gov.in/ecourtindiaHC";
const PARTY = process.argv[2] || "Mohapatra";

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

  // Use form.submit() — bypass button JS, submit the form natively
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {}),
    page.evaluate(() => {
      const f = document.querySelector("form");
      if (f) f.submit();
    }),
  ]);
  await page.waitForTimeout;

  const url = page.url();
  const title = await page.title();
  const bodyText = (await page.evaluate(() => document.body?.innerText ?? "")).substring(0, 5000);
  const tables = await page.evaluate(() =>
    Array.from(document.querySelectorAll("table")).map((t) => ({
      len: t.outerHTML.length,
      firstRow: t.querySelector("tr")?.outerHTML?.substring(0, 500) ?? "",
    }))
  );
  const errors = await page.evaluate(() => {
    return {
      errSpanVisible: document.querySelector("#errSpan")?.style?.display !== "none" ? document.querySelector("#errSpan").textContent : null,
      txtmsg: document.querySelector("#txtmsg")?.value,
      txtmsgTitle: document.querySelector("#txtmsg")?.title,
    };
  });

  const result = {
    probe: "orissa-high-court-final",
    party: PARTY,
    ocr: cleaned,
    ocrConfidence: data.confidence,
    submit: "form.submit()",
    url, title,
    errors,
    tableCount: tables.length,
    tables: tables.map((t) => ({ len: t.len, firstRow: t.firstRow.substring(0, 200) })),
    bodyText,
    bodyTextTail: bodyText.substring(bodyText.length - 1500),
  };

  writeFileSync(`/Users/deekshamohapatra/Documents/cleardeed/packages/fetchers/high-court/fixtures/live-probe-${PARTY.toLowerCase()}.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
