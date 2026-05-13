#!/usr/bin/env npx tsx
/**
 * Quick test of bhulekh fetcher — calls fetch() directly with Mendhasala village.
 * Run: node_modules/.bin/pnpm dlx tsx scripts/test-bhulekh-direct.ts
 */

import { fetch as bhulekhFetch } from "@cleardeed/fetchers/bhulekh";

async function main() {
  console.log("Testing bhulekh fetcher with Mendhasala village, plot 128...");
  console.time("bhulekh");

  const result = await bhulekhFetch({
    gps: { lat: 20.272688, lon: 85.701271 },
    village: "Mendhasala",
    plotNo: "128",
  });

  console.timeEnd("bhulekh");
  console.log("\nResult:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
