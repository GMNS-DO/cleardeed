// Live probe: hcservices.ecourts.gov.in/ecourtindiaHC — Orissa High Court party-name search.
// Captures: form HTML, captcha image, raw response, and post-submit page state.
// Goal: confirm form works end-to-end and produce a raw fixture.

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE_URL = "https://hcservices.ecourts.gov.in/ecourtindiaHC";
const STATE_CODE = "11";
const COURT_CODE = "1";
const PARTY = process.argv[2] || "Mohapatra";

async function main() {
  console.log(`[hc-probe] target: ${BASE_URL}`);
  console.log(`[hc-probe] party: ${PARTY}`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: "ClearDeed/1.0 (probe; contact@cleardeed.in)",
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();

  const artifacts = {
    probe: "orissa-high-court",
    party: PARTY,
    stateCode: STATE_CODE,
    courtCode: COURT_CODE,
    formUrl: `${BASE_URL}/cases/ki_petres.php?state_cd=${STATE_CODE}&dist_cd=1&court_code=${COURT_CODE}&stateNm=Odisha`,
    capturedAt: new Date().toISOString(),
    steps: {},
  };

  try {
    await page.goto(artifacts.formUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout;

    artifacts.steps.formLoad = {
      title: await page.title(),
      url: page.url(),
      elements: await page.evaluate(() => ({
        petres_name: !!document.querySelector("#petres_name"),
        rgyear: !!document.querySelector("#rgyear"),
        captcha_image: !!document.querySelector("#captcha_image"),
        captcha_input: !!document.querySelector("#captcha"),
        submit1: !!document.querySelector('input[name="submit1"]'),
        radios: Array.from(document.querySelectorAll('input[name="f"]')).map((r) => ({
          value: r.value,
          checked: r.checked,
        })),
      })),
      bodyPreview: (await page.content()).substring(0, 5000),
    };

    console.log(`[hc-probe] title: ${artifacts.steps.formLoad.title}`);
    console.log(`[hc-probe] elements:`, artifacts.steps.formLoad.elements);

    if (!artifacts.steps.formLoad.elements.petres_name) {
      throw new Error("petres_name field not present — form not loaded");
    }

    // Trigger captcha by focusing the party field
    await page.focus("#petres_name");
    await page.waitForTimeout(800);

    // Capture captcha image bytes
    artifacts.steps.captcha = await page.evaluate(async () => {
      const img = document.querySelector("#captcha_image");
      if (!img) return null;
      const src = img.src;
      if (!src) return { src: null };
      return { src, width: img.naturalWidth, height: img.naturalHeight };
    });
    console.log(`[hc-probe] captcha src: ${artifacts.steps.captcha?.src}`);

    // Save captcha image to disk for visual inspection
    if (artifacts.steps.captcha?.src) {
      const resp = await ctx.request.get(artifacts.steps.captcha.src);
      const buf = await resp.body();
      writeFileSync("/tmp/hc-captcha.png", buf);
      artifacts.steps.captcha.sizeBytes = buf.length;
      artifacts.steps.captcha.contentType = resp.headers()["content-type"];
      console.log(`[hc-probe] captcha saved to /tmp/hc-captcha.png (${buf.length} bytes)`);
    }

    // Fill form and submit
    await page.fill("#petres_name", PARTY);
    const fRadio = await page.$('input[name="f"][value="Both"]');
    if (fRadio) await fRadio.check();
    await page.screenshot({ path: "/tmp/hc-form-filled.png", fullPage: true });

    // Try submitting with empty captcha to see what error appears
    await page.click('input[name="submit1"]');
    await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout;

    artifacts.steps.submitNoCaptcha = {
      url: page.url(),
      title: await page.title(),
      bodyText: (await page.evaluate(() => document.body?.innerText ?? "")).substring(0, 3000),
    };
    console.log(`[hc-probe] submit (no captcha) result url: ${artifacts.steps.submitNoCaptcha.url}`);

    // Now try with a placeholder captcha to see what the response looks like
    await page.goBack().catch(() => {});
    await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.focus("#petres_name");
    await page.waitForTimeout(500);
    await page.fill("#petres_name", PARTY);
    await page.fill("#captcha", "ABC123");
    if (fRadio) await fRadio.check();
    await page.click('input[name="submit1"]');
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout;

    artifacts.steps.submitWithDummyCaptcha = {
      url: page.url(),
      title: await page.title(),
      bodyText: (await page.evaluate(() => document.body?.innerText ?? "")).substring(0, 4000),
    };
    console.log(`[hc-probe] submit (dummy captcha) result url: ${artifacts.steps.submitWithDummyCaptcha.url}`);

    await page.screenshot({ path: "/tmp/hc-result.png", fullPage: true });

    artifacts.outcome = {
      formLoaded: true,
      petresNamePresent: artifacts.steps.formLoad.elements.petres_name,
      captchaImagePresent: artifacts.steps.formLoad.elements.captcha_image,
      captchaSrc: artifacts.steps.captcha?.src,
      captchaBytes: artifacts.steps.captcha?.sizeBytes,
      submitNoCaptchaLanded: artifacts.steps.submitNoCaptcha.url,
      submitDummyCaptchaLanded: artifacts.steps.submitWithDummyCaptcha.url,
    };
  } catch (err) {
    artifacts.error = String(err instanceof Error ? err.message : err);
    console.error(`[hc-probe] error: ${artifacts.error}`);
  } finally {
    await browser.close();
  }

  const fixturePath = `/Users/deekshamohapatra/Documents/cleardeed/packages/fetchers/high-court/fixtures/live-probe-${PARTY.toLowerCase()}.json`;
  writeFileSync(fixturePath, JSON.stringify(artifacts, null, 2));
  console.log(`[hc-probe] fixture written: ${fixturePath}`);
  console.log(`[hc-probe] outcome:`, artifacts.outcome ?? { error: artifacts.error });
}

main().catch((err) => {
  console.error("[hc-probe] fatal:", err);
  process.exit(1);
});
