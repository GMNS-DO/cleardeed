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

    // Do everything in one browser session without going back
    // 1. Focus party field to trigger captcha load
    await page.focus("#petres_name");
    await page.waitForTimeout(800);

    // 2. Solve captcha using the page's canvas
    const captchaText = await page.evaluate(async () => {
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
      const ctx2 = canvas.getContext("2d");
      ctx2.drawImage(fresh, 0, 0);
      return canvas.toDataURL("image/png");
    });

    if (!captchaText) throw new Error("captcha image not fetched");

    const worker = await createWorker("eng");
    const { data } = await worker.recognize(captchaText);
    await worker.terminate();
    const cleaned = (data.text ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase().substring(0, 8);
    log.push({ step: "ocr", cleaned, confidence: data.confidence });

    // 3. Fill ALL fields and submit immediately
    await page.fill("#petres_name", PARTY);
    await page.fill("#captcha", cleaned);
    const both = await page.$('input[name="f"][value="Both"]');
    if (both) await both.check();

    // Try multiple submissions to see if any succeed
    const attempts = [];
    for (let i = 0; i < 3; i++) {
      // Refresh captcha between attempts
      if (i > 0) {
        await page.evaluate(() => {
          const img = document.querySelector("#captcha_image");
          if (img) img.src = "/ecourtindiaHC/securimage/securimage_show.php?" + Math.random();
        });
        await page.waitForTimeout(700);
        const cd = await page.evaluate(async () => {
          const img = document.querySelector("#captcha_image");
          if (!img || !img.src) return null;
          const fresh = new Image();
          fresh.crossOrigin = "anonymous";
          fresh.src = img.src;
          await new Promise((res) => { fresh.onload = () => res(); fresh.onerror = () => res(); });
          const canvas = document.createElement("canvas");
          canvas.width = fresh.naturalWidth;
          canvas.height = fresh.naturalHeight;
          const ctx2 = canvas.getContext("2d");
          ctx2.drawImage(fresh, 0, 0);
          return canvas.toDataURL("image/png");
        });
        const w = await createWorker("eng");
        const r = await w.recognize(cd);
        await w.terminate();
        const c = (r.data.text ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase().substring(0, 8);
        await page.fill("#petres_name", PARTY);
        await page.fill("#captcha", c);
        if (both) await both.check();
        attempts.push({ iter: i, ocr: c, conf: r.data.confidence });
      } else {
        attempts.push({ iter: i, ocr: cleaned, conf: data.confidence });
      }

      await page.click('input[name="submit1"]');
      await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout;

      const url = page.url();
      const title = await page.title();
      const bodyText = (await page.evaluate(() => document.body?.innerText ?? "")).substring(0, 2500);
      const tables = await page.evaluate(() =>
        Array.from(document.querySelectorAll("table")).map((t) => t.outerHTML.length)
      );
      attempts[attempts.length - 1].result = { url, title, bodyText, tableSizes: tables };
    }

    log.push({ step: "multi_attempts", attempts });
  } catch (err) {
    log.push({ step: "error", error: String(err instanceof Error ? err.message : err) });
  } finally {
    await browser.close();
  }

  writeFileSync("/Users/deekshamohapatra/Documents/cleardeed/packages/fetchers/high-court/fixtures/live-probe-tight.json", JSON.stringify(log, null, 2));
  console.log(JSON.stringify(log, null, 2));
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
