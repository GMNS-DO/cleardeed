import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE_URL = "https://hcservices.ecourts.gov.in/ecourtindiaHC";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: "ClearDeed/1.0 (probe; contact@cleardeed.in)",
  });
  const page = await ctx.newPage();
  await page.goto(
    `${BASE_URL}/cases/ki_petres.php?state_cd=11&dist_cd=1&court_code=1&stateNm=Odisha`,
    { waitUntil: "domcontentloaded", timeout: 30_000 }
  );
  await page.waitForTimeout(800);

  const formInfo = await page.evaluate(() => {
    const form = document.querySelector("form");
    if (!form) return { hasForm: false };
    const all = Array.from(form.querySelectorAll("input, select, textarea, button")).map((el) => ({
      tag: el.tagName,
      type: el.type,
      name: el.name,
      id: el.id,
      value: el.value?.substring?.(0, 50),
      classes: el.className,
    }));
    return {
      hasForm: true,
      formAction: form.action,
      formMethod: form.method,
      formId: form.id,
      fields: all,
      bodyText: document.body?.innerText?.substring(0, 6000),
      fullHtml: document.documentElement.outerHTML.length,
    };
  });

  writeFileSync("/Users/deekshamohapatra/Documents/cleardeed/packages/fetchers/high-court/fixtures/live-form-fields.json", JSON.stringify(formInfo, null, 2));
  console.log(JSON.stringify(formInfo, null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
