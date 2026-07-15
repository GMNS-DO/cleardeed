/**
 * qa/bhulekh_to_bhunaksha_session_probe.mjs
 *
 * Sprint V+ — Cross-portal session-passing probe.
 *
 * Question: When a Bhulekh RoR back page renders a <a> in the gvRorBack
 * plot-table, is the href session-bound to the Bhulekh page load, or is
 * it a stateless URL that can be followed from a fresh context?
 *
 * Method:
 *   1. Bootstrap Playwright on Bhulekh / RoRView.aspx.
 *   2. Drive the dropdown cascade (district → tehsil → village → RI → mouza
 *      → khatiyan → plot) for Mendhasala / Plot 415 — a known-good
 *      ground-truth plot (qa/ground_truth/P001).
 *   3. Submit "View RoR" → land on the front page.
 *   4. Navigate to SRoRBack_Uni.aspx → back page (Page 2) renders.
 *   5. For every <a id="gvRorBack_..._lblPlotNo"> in the back page:
 *        - Read the href attribute (raw string).
 *        - Read the cookies currently set on the page.
 *      Then follow the href in the SAME page.
 *   6. Observe the response:
 *        - did the navigation succeed (no 403 / no login wall)?
 *        - did the Jasper plot report render (positioned divs present)?
 *        - did the cadastral map <img> load (200 on the map URL)?
 *   7. Also probe: a fresh, no-cookie context loading the same href.
 *        - does the same URL work without the Bhulekh session?
 *
 * Output: a structured JSON line per observation, printed to stdout, plus
 * a final summary. Exit code 0 on success, 1 if Playwright crashes, 2 if
 * the live portal is unreachable.
 *
 * Run with: node qa/bhulekh_to_bhunaksha_session_probe.mjs
 */

import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";

const BHULEKH_URL = "https://bhulekh.ori.nic.in";
const ROR_VIEW_URL = `${BHULEKH_URL}/RoRView.aspx`;
const ROR_REPORT_URL = `${BHULEKH_URL}/SRoRFront_Uni.aspx`;
const ROR_BACK_URL = `${BHULEKH_URL}/SRoRBack_Uni.aspx`;

const TIMEOUT_MS = 30_000;
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 ClearDeed-Probe/1.0";

const observations = [];
const startedAt = new Date().toISOString();

function log(obs) {
  observations.push({ ts: new Date().toISOString(), ...obs });
  console.log(JSON.stringify(obs));
}

async function pickFromSelect(page, selectId, visibleText) {
  // ASP.NET dropdowns are server-rendered <select>. We pick by visible text
  // (not by value) because some cascading selects populate values
  // dynamically and the visible text is the only stable label.
  const handle = await page.$(`#${selectId}`);
  if (!handle) throw new Error(`select#${selectId} not found`);
  // Use the SelectOption API by label.
  await page.selectOption(`#${selectId}`, { label: visibleText });
  // ASP.NET postback fires on change. Wait for the network to settle.
  await page.waitForLoadState("networkidle", { timeout: TIMEOUT_MS }).catch(() => undefined);
}

async function readHrefsAndCookies(page) {
  return page.evaluate(() => {
    const anchors = Array.from(
      document.querySelectorAll('a[id^="gvRorBack_"][id$="_lblPlotNo"]')
    );
    return anchors.map((a) => ({
      id: a.id,
      text: (a.textContent || "").trim(),
      href: a.getAttribute("href") || null,
      outerHtml: a.outerHTML.slice(0, 240),
    }));
  });
}

async function readCookies(context) {
  return context.cookies();
}

async function probeFreshContextLoad(browser, href) {
  // Open a brand-new context with NO cookies, no local storage, no Bhulekh
  // session. Try to load the href directly. If the URL is stateless, this
  // should render the Bhunaksha plot report. If it's session-bound, this
  // should 403 / redirect to a login / show a blank page.
  const ctx = await browser.newContext({ userAgent: USER_AGENT });
  const page = await ctx.newPage();
  try {
    const resp = await page.goto(href, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT_MS,
    });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    const status = resp ? resp.status() : null;
    const finalUrl = page.url();
    const bodyText = (await page.evaluate(() => document.body?.innerText || "")).slice(0, 600);
    const hasMap = await page
      .$('img[src*="map"], img[src*="cadastral"], img[src*="plot"]')
      .then((h) => (h ? h.getAttribute("src") : null))
      .catch(() => null);
    const positionedDivs = await page
      .$$eval('div[style*="position:absolute"]', (els) => els.length)
      .catch(() => 0);
    return { status, finalUrl, bodyText, hasMap, positionedDivs, ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    await ctx.close();
  }
}

async function main() {
  log({ event: "probe_start", startedAt, plot: "Mendhasala/415" });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  try {
    // ── Step 1: Bootstrap Bhulekh ──────────────────────────────────────
    // The portal redirects RoRView.aspx → BhulekhError.aspx on first load
    // (an interstitial). Click the "here" LinkButton to advance to the
    // real RoRView.aspx where the dropdowns render. Discovered via
    // qa/bhulekh_postback_introspect.mjs on 2026-06-17.
    log({ event: "step", step: "1a_initial_load", url: ROR_VIEW_URL });
    await page.goto(ROR_VIEW_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    log({ event: "after_initial_load", url: page.url() });

    const hereLink = await page.$("#ctl00_ContentPlaceHolder1_LinkButton1");
    if (hereLink) {
      log({ event: "step", step: "1b_click_here_linkbutton" });
      await hereLink.click();
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(500);
    } else {
      log({ event: "here_linkbutton_not_found", url: page.url() });
    }
    log({ event: "after_here_click", url: page.url() });

    const cookiesAfterBootstrap = await readCookies(context);
    log({
      event: "bootstrap_cookies",
      count: cookiesAfterBootstrap.length,
      names: cookiesAfterBootstrap.map((c) => c.name),
    });

    // ── Step 2: Drive the cascade (using real Bhulekh control IDs) ─────
    // From packages/fetchers/bhulekh/src/index.ts: the portal uses ASP.NET
    // master-page naming: ctl00_ContentPlaceHolder1_ddl{District|Tahsil|Village|BindData}
    // and the View RoR button is ctl00_ContentPlaceHolder1_btnRORFront.
    // Codes: District=20 (Khordha), Tahasil=2 (Bhubaneswar), Village=105 (Mendhasala).
    // Plot 415 lives in ddlBindData — but BindData is a unionized dropdown
    // populated after Village is picked, with values like "415::1".
    log({ event: "step", step: "2_cascade" });

    const districtCode = "20";
    const tahasilCode = "2";
    const villageCode = "105";

    log({ event: "cascade_pick", id: "ddlDistrict", value: districtCode });
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlDistrict", districtCode);
    await page.waitForTimeout(750);
    const tahasilOpts = await page.$$eval("#ctl00_ContentPlaceHolder1_ddlTahsil option", (els) =>
      els.map((e) => ({ value: e.value, text: e.textContent?.trim() }))
    );
    log({ event: "tahasil_options_after_district", count: tahasilOpts.length, sample: tahasilOpts.slice(0, 3) });

    log({ event: "cascade_pick", id: "ddlTahsil", value: tahasilCode });
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlTahsil", tahasilCode);
    await page.waitForTimeout(750);
    const villageOpts = await page.$$eval("#ctl00_ContentPlaceHolder1_ddlVillage option", (els) =>
      els.map((e) => ({ value: e.value, text: e.textContent?.trim() }))
    );
    log({ event: "village_options_after_tahasil", count: villageOpts.length, mendhasalaMatch: villageOpts.find((o) => o.text?.includes("Mendhasala") || o.text?.includes("ମେଣ୍ଢାଶାଳ")) });

    log({ event: "cascade_pick", id: "ddlVillage", value: villageCode });
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlVillage", villageCode);
    await page.waitForTimeout(750);

    // Search-mode radio must be set before ddlBindData populates. Click "Plot".
    log({ event: "search_mode_radio", mode: "Plot" });
    await page
      .locator('input[name="ctl00$ContentPlaceHolder1$rbtnRORSearchtype"][value="Plot"]')
      .click();
    await page.waitForTimeout(750);

    const bindDataOpts = await page.$$eval("#ctl00_ContentPlaceHolder1_ddlBindData option", (els) =>
      els.map((e) => ({ value: e.value, text: e.textContent?.trim() }))
    );
    log({ event: "bind_data_options_after_village", count: bindDataOpts.length, sample: bindDataOpts.slice(0, 5) });

    // Pick the BindData option whose text contains "415" (the plot we want).
    const match415 = bindDataOpts.find((o) => o.text?.includes("415"));
    if (!match415) {
      log({ event: "bind_data_no_415_match", bindDataOpts });
      throw new Error("Plot 415 not present in ddlBindData for Mendhasala");
    }
    log({ event: "cascade_pick", id: "ddlBindData", value: match415.value, text: match415.text });
    await page.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", match415.value);
    await page.waitForTimeout(750);

    // ── Step 3: Submit "View RoR" ──────────────────────────────────────
    log({ event: "step", step: "3_submit_view_ror" });
    await page.click("#ctl00_ContentPlaceHolder1_btnRORFront");
    await Promise.race([
      page.waitForURL(/SRoRFront_Uni\.aspx/, { timeout: TIMEOUT_MS }),
      page.waitForLoadState("networkidle", { timeout: TIMEOUT_MS }),
    ]).catch(() => undefined);
    log({ event: "front_page_loaded", url: page.url() });
    const frontPageHtml = (await page.content()).slice(0, 2000);
    log({ event: "front_page_html_excerpt", html: frontPageHtml });

    // ── Step 4: Navigate to the back page ──────────────────────────────
    log({ event: "step", step: "4_back_page", url: ROR_BACK_URL });
    await page.goto(ROR_BACK_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    const backPageUrl = page.url();
    const backPageBodyText = (await page.evaluate(() => document.body?.innerText || "")).slice(0, 800);
    log({ event: "back_page_loaded", url: backPageUrl, bodyTextExcerpt: backPageBodyText });

    // ── Step 5: Read every <a id="gvRorBack_..._lblPlotNo"> ───────────
    const hrefs = await readHrefsAndCookies(page);
    const cookiesBeforeFollow = await readCookies(context);
    log({
      event: "back_page_anchors",
      count: hrefs.length,
      sample: hrefs.slice(0, 3),
    });
    log({
      event: "cookies_before_follow",
      count: cookiesBeforeFollow.length,
      names: cookiesBeforeFollow.map((c) => `${c.name} (${c.domain})`),
    });

    if (hrefs.length === 0) {
      log({ event: "no_anchors", backPageBodyText });
      throw new Error("No <a id=..._lblPlotNo> anchors on back page — probe inconclusive");
    }

    // ── Step 6: Follow the FIRST href in the same context ─────────────
    const firstHref = hrefs[0].href;
    log({ event: "step", step: "6_follow_href_same_context", href: firstHref });
    let sameContext = null;
    if (firstHref) {
      try {
        const resp = await page.goto(firstHref, {
          waitUntil: "domcontentloaded",
          timeout: TIMEOUT_MS,
        });
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
        const status = resp ? resp.status() : null;
        const finalUrl = page.url();
        const hasMap = await page
          .$('img[src*="map"], img[src*="cadastral"], img[src*="plot"]')
          .then((h) => (h ? h.getAttribute("src") : null))
          .catch(() => null);
        const positionedDivs = await page
          .$$eval('div[style*="position:absolute"]', (els) => els.length)
          .catch(() => 0);
        const bodyText = (await page.evaluate(() => document.body?.innerText || "")).slice(0, 600);
        sameContext = { status, finalUrl, hasMap, positionedDivs, bodyText };
        log({ event: "same_context_follow_result", ...sameContext });
      } catch (err) {
        sameContext = { error: err instanceof Error ? err.message : String(err) };
        log({ event: "same_context_follow_error", ...sameContext });
      }
    } else {
      log({ event: "first_href_null" });
    }

    // ── Step 7: Probe the same href from a fresh, no-cookie context ────
    log({ event: "step", step: "7_probe_fresh_context", href: firstHref });
    const freshResult = firstHref
      ? await probeFreshContextLoad(browser, firstHref)
      : { ok: false, error: "firstHref was null" };
    log({ event: "fresh_context_result", ...freshResult });

    // ── Summary ────────────────────────────────────────────────────────
    const verdict = {
      event: "verdict",
      sameContextRendered:
        sameContext && sameContext.positionedDivs > 5 && sameContext.status === 200,
      freshContextRendered:
        freshResult && freshResult.ok && freshResult.positionedDivs > 5 && freshResult.status === 200,
      sameContextStatus: sameContext?.status ?? null,
      freshContextStatus: freshResult?.status ?? null,
      conclusion: null,
    };
    if (verdict.sameContextRendered && verdict.freshContextRendered) {
      verdict.conclusion =
        "STATELESS: Same-context AND fresh-context both render. The href is a canonical URL with no session dependency. We can fetch all N plots in parallel from a fresh context after reading the hrefs.";
    } else if (verdict.sameContextRendered && !verdict.freshContextRendered) {
      verdict.conclusion =
        "SESSION-BOUND-SAME-ORIGIN: Same-context renders, fresh-context fails. The href works only when the Bhulekh session cookie is forwarded. We must keep one Playwright context alive and navigate to each href sequentially in that context.";
    } else if (!verdict.sameContextRendered && verdict.freshContextRendered) {
      verdict.conclusion =
        "UNEXPECTED: Fresh-context renders but same-context does not. The Bhulekh session may actively interfere. Worth re-running — the same-context failure could be a transient portal error.";
    } else {
      verdict.conclusion =
        "BOTH-FAIL: Neither context renders. The portal may be down, the href may be malformed, or the back page render is broken. Probe inconclusive — investigate the raw response bodies.";
    }
    log(verdict);
  } catch (err) {
    log({ event: "fatal", error: err instanceof Error ? err.message : String(err), stack: err.stack });
    process.exitCode = 1;
  } finally {
    await browser.close();
    const finishedAt = new Date().toISOString();
    log({ event: "probe_end", startedAt, finishedAt, observationCount: observations.length });
    writeFileSync(
      "qa/bhulekh_to_bhunaksha_session_probe_2026-06-17.json",
      JSON.stringify({ startedAt, finishedAt, observations }, null, 2)
    );
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
