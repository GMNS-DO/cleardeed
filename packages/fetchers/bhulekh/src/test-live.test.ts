/**
 * Live integration test — runs against real bhulekh.ori.nic.in
 * Run: pnpm exec vitest run packages/fetchers/bhulekh/src/test-live.test.ts
 */
import { describe, it, expect } from "vitest";
import { writeFileSync } from "fs";

describe("Bhulekh live fetcher (Mendhasala plot 1)", () => {
  it("fetches RoR and returns owner + plots + screenshots + back page", async () => {
    const { fetch } = await import("./index.ts");
    const result = await fetch({ village: "Mendhasala", plotNo: "1" });

    const diag: Record<string, unknown> = {
      status: result.status,
      statusReason: result.statusReason,
      hasData: result.data != null,
    };

    if (result.data) {
      const d = result.data as Record<string, unknown>;
      diag.tenants = (d.tenants as unknown[] | undefined)?.length;
      diag.plotNo = d.plotNo;
      const tenants = d.tenants as Array<Record<string, unknown>> | undefined;
      if (tenants?.length) {
        diag.tenant0 = tenants[0];
      }
    }

    if (result.rawResponse) {
      const raw = JSON.parse(result.rawResponse);
      diag.backPageMutations = raw.backPage?.mutationHistory?.length ?? 0;
      diag.backPageEncumbrances = raw.backPage?.encumbranceEntries?.length ?? 0;
      diag.screenshots = raw.screenshots ?? "none";
    }

    writeFileSync("/tmp/bhulekh-live-diag.json", JSON.stringify(diag, null, 2));

    // Assertions
    expect(result.status).toBeTruthy();
    expect(result.data?.tenants?.length).toBeGreaterThan(0);
  }, 90_000);
});