/**
 * Direct test: calls Bhulekh fetcher directly to trace exact data
 * Usage: npx tsx scripts/test-bhulekh-direct.ts
 */
import { fetch as bhulekhFetch } from "@cleardeed/fetcher-bhulekh";

async function test() {
  const params = {
    tehsil: "Bhubaneswar",
    tehsilCode: "2",
    village: "Mendhasala",
    villageCode: "105",
    searchMode: "Plot" as const,
    identifierValue: "128",
    identifierLabel: "128",
  };

  console.info("Fetching Bhulekh for:", params);
  const start = Date.now();

  try {
    const result = await bhulekhFetch(params as any);
    const elapsed = Date.now() - start;

    console.info("\n=== BHULEKH RESULT ===");
    console.info("Status:", result.status);
    console.info("Status reason:", result.statusReason);
    console.info("Time:", elapsed, "ms");
    console.info("Data keys:", Object.keys(result.data ?? {}));

    if (result.data) {
      const data = result.data as any;
      console.info("khataNo:", data.khataNo);
      console.info("village:", data.village);
      console.info("tenant count:", data.tenants?.length ?? 0);
      console.info("lastUpdated:", data.lastUpdated);

      if (data.tenants?.length > 0) {
        console.info("\n=== FIRST TENANT ===");
        console.info(JSON.stringify(data.tenants[0], null, 2));
      }
    }

    if (result.rawResponse) {
      const raw = JSON.parse(result.rawResponse);
      console.info("\n=== RAW DOCUMENT ===");
      console.info("record keys:", Object.keys(raw.record ?? {}));
      console.info("tenantNameOdia:", raw.record?.tenantNameOdia);
      console.info("guardianNameOdia:", raw.record?.guardianNameOdia);
      console.info("khatiyanNo:", raw.record?.khatiyanNo);
      console.info("ownerBlocks count:", raw.record?.ownerBlocks?.length ?? 0);
      console.info("first owner block:", JSON.stringify(raw.record?.ownerBlocks?.[0], null, 2));

      console.info("\n=== PLOT TABLE ===");
      console.info("plot rows:", raw.plotTable?.rows?.length ?? 0);
      if (raw.plotTable?.rows?.length > 0) {
        console.info("first row:", JSON.stringify(raw.plotTable.rows[0], null, 2));
      }
    }
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test().catch(console.error);
