#!/usr/bin/env node
/**
 * Probe Bhulekh's SearchYourPlot.aspx — plot unique ID lookup.
 * This page takes a district + plot unique ID directly, bypassing dropdown cascade.
 */
import { chromium } from "playwright";

const BASE_URL = "https://bhulekh.ori.nic.in";
const SEARCH_URL = `${BASE_URL}/SearchYourPlot.aspx`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });

  console.log("=== Bhulekh Plot Unique ID Search ===\n");

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`Attempt ${attempt}: navigating to SearchYourPlot.aspx...`);
      await page.goto(SEARCH_URL, { waitUntil: "commit", timeout: 30000 });
      console.log(`  URL: ${page.url()}`);
      console.log(`  Title: ${await page.title()}`);

      // Wait for form elements
      await page.waitForTimeout;

      // Check if district dropdown exists
      const districtDdl = await page.$("#ddl_district, #ctl00_ContentPlaceHolder1_ddlDistrict");
      console.log(`  District dropdown: ${districtDdl ? 'found' : 'NOT found'}`);

      // Check all selects
      const selects = await page.$$("select");
      console.log(`  Total selects: ${selects.length}`);
      for (const sel of selects) {
        const id = await sel.getAttribute("id");
        const name = await sel.getAttribute("name");
        console.log(`    select: id=${id}, name=${name}`);
        const opts = await sel.$$("option");
        console.log(`    options: ${opts.length}`);
      }

      // Check form fields
      const inputs = await page.$$("input[type=text]");
      for (const inp of inputs) {
        const id = await inp.getAttribute("id");
        const name = await inp.getAttribute("name");
        const placeholder = await inp.getAttribute("placeholder");
        console.log(`    input: id=${id}, name=${name}, placeholder=${placeholder}`);
      }

      break;
    } catch (e) {
      console.log(`  ERROR: ${e.message.split('\n')[0]}`);
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  // Try to read page content
  const content = await page.content();
  console.log(`\nPage HTML length: ${content.length}`);

  // Extract key info
  const districtOpts = content.match(/<option[^>]*value="(\d+)"[^>]*>.*?<\/option>/gi);
  if (districtOpts) {
    console.log(`\nDistrict options found: ${districtOpts.length}`);
    for (const opt of districtOpts.slice(0, 5)) {
      const val = opt.match(/value="([^"]+)"/)?.[1];
      const text = opt.match(/>([^<]+)</)?.[1]?.trim();
      console.log(`  [${val}] "${text}"`);
    }
  }

  await browser.close();
}

main().catch(e => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
