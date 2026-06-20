import { describe, it } from "vitest";
import { fetch as bhulekhFetch } from "./index";

describe("Bhulekh live probe — Candaka plot 181 (Bhubaneswar)", () => {
  it("fetches RoR for the user's input", async () => {
    const result = await bhulekhFetch({
      tehsil: "Bhubaneswar",
      tehsilCode: "2",
      village: "Candaka",
      villageCode: "76",
      riCircle: "Chandaka",
      searchMode: "Plot",
      identifierValue: "181",
      identifierLabel: "Plot",
    });
    console.log("\n=== LIVE RESULT ===");
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
    if (result.data?.tenants?.length) {
      console.log("First owner:", JSON.stringify(result.data.tenants[0], null, 2));
    }
  }, 120_000);
});
