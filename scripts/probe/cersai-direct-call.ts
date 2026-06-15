/**
 * scripts/probe/cersai-direct-call.ts
 * Final attempt: locate the Vue component instance and call submitThisForm
 * after setting state directly. Uses the global srchInput handle exposed
 * by the dbtrsrch.js module.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let frgBody = "";
  page.on("response", async (r) => {
    const u = r.url();
    if (/\.frg($|\?)/.test(u) && r.status() === 200) {
      const body = await r.text().catch(() => "(err)");
      if (body.length > 200 && body.length < 100_000) {
        console.log(`[FRG] ${r.status()} ${u} bodyLen=${body.length}`);
        if (!/^<html>/.test(body) || body.length < 20000) {
          frgBody = body;
        }
      }
    } else if (/CaptchaHash/.test(u)) {
      const body = await r.text().catch(() => "(err)");
      console.log(`[CaptchaHash] ${r.status()} ${u} body=${body.slice(0, 200)}`);
    }
  });
  page.on("console", (msg) => {
    const t = msg.text();
    if (t.length < 600 && /error|warn|charge|record|found|insufficient/i.test(t)) {
      console.log(`[console-${msg.type()}] ${t}`);
    }
  });

  await page.goto("https://cersai.org.in/CERSAI/dbtrsrch.prg", { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForSelector("#debtorType", { timeout: 15_000 });

  // Look in iframes too — the Vue fragment may be in an iframe
  const frameUrls = page.frames().map((f) => f.url());
  console.log(`Frames: ${JSON.stringify(frameUrls)}`);

  // The Vue app exposes srchInput as a global from dbtrsrch.js
  // Use Vue's lifecycle to access it via the mounted component
  const result = await page.evaluate(() => {
    // Find the Vue component on the page
    const iframes = Array.from(document.querySelectorAll("iframe"));
    const root = document.querySelector("#dbtrsrch") as any || document.querySelector("[data-v-app]") as any || document.body;
    // Walk up to find the Vue component
    let el = root as any;
    let component = null;
    while (el && !component) {
      component = (el as any).__vueParentComponent || (el as any).__vue__;
      el = el.parentElement;
    }
    if (!component) return { error: "no Vue component found", iframes: iframes.length, html: document.body.innerHTML.slice(0, 500) };

    // Walk down to find srchInput
    const ctx = component.ctx || component.setupState;
    const setupKeys = ctx ? Object.keys(ctx) : [];
    const has = (k: string) => setupKeys.includes(k) || (typeof component.setupState?.[k] !== "undefined");

    return {
      hasValidateTheCaptcha: has("validateTheCaptcha"),
      hasSubmitThisForm: has("submitThisForm"),
      hasIsDataInsufficient: has("isDataInsufficient"),
      hasMyobject: has("myobject"),
      hasCaptcha: has("captcha"),
      keys: setupKeys,
    };
  });

  console.log(`Vue introspection:`, JSON.stringify(result, null, 2));

  if ((result as any).error) {
    await browser.close();
    return;
  }

  // Set the form state directly via Vue's data
  const setResult = await page.evaluate(() => {
    const root = document.querySelector("#dbtrsrch") as any || document.querySelector("[data-v-app]") as any || document.body;
    let el = root;
    let component = null;
    while (el && !component) {
      component = (el as any).__vueParentComponent || (el as any).__vue__;
      el = el.parentElement;
    }
    if (!component) return { error: "no Vue component" };

    const ctx = component.setupState || component.ctx;
    if (ctx.myobject) {
      ctx.myobject.searchInput.assetCategoryId = "1";
      ctx.myobject.searchInput.inputJson.type = "IND";
      ctx.myobject.searchInput.inputJson.individualName = "Deeksha Mahapatra";
    }
    return { ok: true, myobject: JSON.stringify(ctx.myobject?.searchInput ?? null) };
  });
  console.log(`Set state:`, JSON.stringify(setResult, null, 2));

  // Solve captcha and fill input
  const captchaBuf = await page.locator("img[src*='captcha.jpg']:visible").last().screenshot();
  const b64 = captchaBuf.toString("base64");
  const r = await fetch("http://localhost:5001/solve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: b64 }),
  });
  const j = await r.json();
  console.log(`ddddocr: "${j.text}"`);

  // Set Vue captcha state and call validateTheCaptcha
  const submitResult = await page.evaluate((captchaText) => {
    const root = document.querySelector("#dbtrsrch") as any || document.querySelector("[data-v-app]") as any || document.body;
    let el = root;
    let component = null;
    while (el && !component) {
      component = (el as any).__vueParentComponent || (el as any).__vue__;
      el = el.parentElement;
    }
    if (!component) return { error: "no Vue component" };
    const ctx = component.setupState || component.ctx;
    if (ctx.captcha !== undefined) ctx.captcha = captchaText;
    if (typeof ctx.validateTheCaptcha === "function") {
      ctx.validateTheCaptcha();
      return { action: "validateTheCaptcha" };
    }
    if (typeof ctx.submitThisForm === "function") {
      ctx.submitThisForm();
      return { action: "submitThisForm direct" };
    }
    return { error: "no submit method", keys: Object.keys(ctx).filter(k => typeof ctx[k] === "function").slice(0, 20) };
  }, j.text);

  console.log(`Submit:`, JSON.stringify(submitResult, null, 2));
  await new Promise((res) => setTimeout(res, 6_000));

  const body = await page.evaluate(() => document.body.innerText);
  console.log(`\n=== BODY AFTER SUBMIT (500) ===\n${body.replace(/\s+/g, " ").trim().slice(0, 500)}`);

  if (frgBody) {
    writeFileSync("/tmp/cersai-frg-direct.html", frgBody);
    console.log(`saved .frg body (${frgBody.length} bytes)`);
  }

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
