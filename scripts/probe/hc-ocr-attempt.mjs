import { chromium } from "playwright";
import { createWorker } from "tesseract.js";
import { writeFileSync } from "node:fs";

const BASE_URL = "https://hcservices.ecourts.gov.in/ecourtindiaHC";
const PARTY = "Mohapatra";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: "ClearDeed/1.0 (probe; contact@cleardeed.in)",
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();

  const log = [];

  try {
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
      await new Promise((res, rej) => {
        fresh.onload = () => res();
        fresh.onerror = rej;
      });
      const canvas = document.createElement("canvas");
      canvas.width = fresh.naturalWidth;
      canvas.height = fresh.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(fresh, 0, 0);
      return { dataUrl: canvas.toDataURL("image/png"), w: fresh.naturalWidth, h: fresh.naturalHeight };
    });

    writeFileSync("/tmp/hc-captcha-dataurl.png", Buffer.from(captchaDataUrl.dataUrl.split(",")[1], "base64"));
    log.push({ step: "captcha_fetched", w: captchaDataUrl.w, h: captchaDataUrl.h });

    const worker = await createWorker("eng");
    const { data } = await worker.recognize(captchaDataUrl.dataUrl);
    await worker.terminate();
    const raw = (data.text ?? "").trim();
    const cleaned = raw.replace(/[^A-Z0-9]/gi, "").toUpperCase().substring(0, 8);
    log.push({ step: "ocr", raw, cleaned, confidence: data.confidence });

    await page.fill("#petres_name", PARTY);
    await page.fill("#captcha", cleaned);
    const both = await page.$('input[name="f"][value="Both"]');
    if (both) await both.check();
    await page.click('input[name="submit1"]');
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout;

    const resultUrl = page.url();
    const resultTitle = await page.title();
    const bodyText = (await page.evaluate(() => document.body?.innerText ?? "")).substring(0, 4000);
    const tables = await page.evaluate(() =>
      Array.from(document.querySelectorAll("table")).map((t) => t.outerHTML)
    );

    log.push({ step: "submit_result", url: resultUrl, title: resultTitle, tableCount: tables.length, bodyText });
    log.push({ step: "tables", count: tables.length });
    if (tables.length > 0) {
      writeFileSync("/tmp/hc-result-tables.html", tables.join("\n\n<!-- table break -->\n\n"));
    }
  } catch (err) {
    log.push({ step: "error", error: String(err instanceof Error ? err.message : err) });
  } finally {
    await browser.close();
  }

  writeFileSync("/tmp/hc-ocr-log.json", JSON.stringify(log, null, 2));
  console.log(JSON.stringify(log, null, 2));
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
