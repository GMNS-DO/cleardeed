// Live probe: cis.drt.gov.in/drtlive — DRT Cuttack party-name search.
// Captures: page HTML (form), AJAX-cascaded case_type options, and post-submit table.
// Goal: confirm form works end-to-end and produce a raw fixture.

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE_URL = "https://cis.drt.gov.in/drtlive";
const PARTY = process.argv[2] || "Mohapatra";

async function main() {
  console.log(`[drt-probe] target: ${BASE_URL}`);
  console.log(`[drt-probe] party: ${PARTY}`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: "ClearDeed/1.0 (probe; contact@cleardeed.in)",
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();

  const artifacts = {
    probe: "drt-cuttack",
    party: PARTY,
    formUrl: `${BASE_URL}/order/page1_advocate.php`,
    capturedAt: new Date().toISOString(),
    steps: {},
  };

  try {
    // 1. Load search page
    await page.goto(artifacts.formUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(800);

    artifacts.steps.formHtml = {
      title: await page.title(),
      formElements: await page.evaluate(() => {
        const result = {
          schemaname: !!document.querySelector("#schemaname"),
          case_type: !!document.querySelector("#case_type"),
          partyInput: !!document.querySelector('input[name="petitioner respondent"]'),
          submit: !!document.querySelector('input[type="submit"]'),
        };
        const sch = document.querySelector("#schemaname");
        if (sch instanceof HTMLSelectElement) {
          result.schemanameOptions = Array.from(sch.options).map((o) => ({
            value: o.value,
            text: o.text,
          })).slice(0, 30);
        }
        return result;
      }),
      bodyPreview: (await page.content()).substring(0, 4000),
    };

    console.log(`[drt-probe] form loaded; title="${artifacts.steps.formHtml.title}"`);
    console.log(`[drt-probe] form elements:`, artifacts.steps.formHtml.formElements);

    if (!artifacts.steps.formHtml.formElements.schemaname) {
      throw new Error("schemaname dropdown not present");
    }

    // 2. Select DRT Cuttack (code 20) and wait for case_type cascade
    await page.selectOption("#schemaname", "20");
    try {
      await page.waitForFunction(
        () => {
          const sel = document.querySelector("#case_type");
          return sel && sel.options.length > 1;
        },
        { timeout: 15_000 }
      );
    } catch (err) {
      console.log(`[drt-probe] case_type cascade did not populate within 15s`);
    }
    await page.waitForTimeout(800);

    artifacts.steps.afterSchemanameSelect = await page.evaluate(() => {
      const sel = document.querySelector("#case_type");
      if (!(sel instanceof HTMLSelectElement)) return null;
      return Array.from(sel.options).map((o) => ({ value: o.value, text: o.text }));
    });
    console.log(`[drt-probe] case_type options: ${artifacts.steps.afterSchemanameSelect?.length ?? 0}`);

    // 3. Fill party name and submit
    await page.fill('input[name="petitioner respondent"]', PARTY);
    await page.click('input[type="submit"]');

    // Wait for result page or error message
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout;

    artifacts.steps.resultHtml = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll("table")).map((t) => t.outerHTML);
      const messages = Array.from(
        document.querySelectorAll(".alert, .notice, .error, [class*='no-record'], .msg, .message")
      ).map((m) => m.textContent?.trim() ?? "");
      const bodyText = document.body?.innerText?.substring(0, 6000) ?? "";
      return { tableCount: tables.length, tableHtml: tables.join("\n\n--TABLE--\n\n"), messages, bodyText };
    });

    artifacts.steps.resultUrl = page.url();
    artifacts.steps.resultTitle = await page.title();

    console.log(`[drt-probe] result url: ${artifacts.steps.resultUrl}`);
    console.log(`[drt-probe] result title: ${artifacts.steps.resultTitle}`);
    console.log(`[drt-probe] tables: ${artifacts.steps.resultHtml.tableCount}`);
    console.log(`[drt-probe] messages:`, artifacts.steps.resultHtml.messages);

    await page.screenshot({ path: "/tmp/drt-result.png", fullPage: true });

    artifacts.outcome = {
      formLoaded: true,
      caseTypeCascaded: (artifacts.steps.afterSchemanameSelect?.length ?? 0) > 1,
      formSubmitted: true,
      resultTables: artifacts.steps.resultHtml.tableCount,
      resultMessages: artifacts.steps.resultHtml.messages,
    };
  } catch (err) {
    artifacts.error = String(err instanceof Error ? err.message : err);
    console.error(`[drt-probe] error: ${artifacts.error}`);
  } finally {
    await browser.close();
  }

  const fixturePath = `/Users/deekshamohapatra/Documents/cleardeed/packages/fetchers/drt/fixtures/live-probe-${PARTY.toLowerCase()}.json`;
  writeFileSync(fixturePath, JSON.stringify(artifacts, null, 2));
  console.log(`[drt-probe] fixture written: ${fixturePath}`);
  console.log(`[drt-probe] outcome:`, artifacts.outcome ?? { error: artifacts.error });
}

main().catch((err) => {
  console.error("[drt-probe] fatal:", err);
  process.exit(1);
});
