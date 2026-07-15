import { describe, it, expect } from "vitest";
import { fetch as bhulekhFetch } from "@cleardeed/fetcher-bhulekh";

describe("Bhulekh live probe — Candaka plot 181", () => {
  it("fetches RoR", async () => {
    const result = await bhulekhFetch({
      tehsil: "Bhubaneswar",
      tahasilCode: "2",
      village: "Candaka",
      villageCode: "76",
      riCircle: "Chandaka",
      searchMode: "Plot",
      identifierValue: "181",
      identifierLabel: "Plot",
    });
    console.log("\n--- Result ---");
    console.log("Status:", result.status);
    console.log("Status reason:", result.statusReason);
    console.log("Owner count:", result.data?.tenants?.length);
    console.log("Plot count:", result.data?.plots?.length);
    if (result.data?.plots?.length) {
      console.log("First plot:", JSON.stringify(result.data.plots[0], null, 2));
    }
    if (result.warnings?.length) {
      console.log("Warnings:", result.warnings);
    }
  }, 90_000);
});
