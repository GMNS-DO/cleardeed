// V5b live smoke — runs all 3 fetchers against the live IGR Odisha portal.
// Mirrors what the pipeline does at V11 Step 2g/2h/2i.
import { igrBmvFetch } from "../../packages/fetchers/igr-bmv/src/index.ts";
import { stampDutyFetch } from "../../packages/fetchers/stamp-duty/src/index.ts";
import { igrDailyBulletinFetch } from "../../packages/fetchers/igr-daily-bulletin/src/index.ts";

const log = (label: string, ok: boolean, detail: string) =>
  console.log(`[${ok ? "OK" : "FAIL"}] ${label} — ${detail}`);

(async () => {
  console.log("=== Sprint V5b — live smoke against igrodisha.gov.in ===");
  console.log(`Date: ${new Date().toISOString()}`);

  // 1) IGR BMV — Mendhasala / Bhubaneswar SRO / Bari kisam
  try {
    const r = await igrBmvFetch({ sro: "Bhubaneswar", village: "Mendhasala", kisam: "Bari" });
    const ok = r.status === "success" || r.status === "partial" || r.status === "not_covered";
    log("igr-bmv", ok, `status=${r.status} reason=${r.statusReason} rows=${r.data?.rows?.length ?? 0} attempts=${r.attempts ?? 0}`);
    if (r.data?.rows?.[0]) {
      const row = r.data.rows[0];
      console.log(`    → mouza=${row.mouza} sro=${row.sro} ratePerSqft=${row.ratePerSqft} ratePerAcre=${row.ratePerAcre}`);
    }
  } catch (e: any) {
    log("igr-bmv", false, `EXCEPTION: ${e?.message ?? e}`);
  }

  // 2) Stamp duty — Sale deed, ₹50L market value, Bhubaneswar
  try {
    const r = await stampDutyFetch({ sro: "Bhubaneswar", marketValue: 5_000_000, deedType: "Sale" });
    const ok = r.status === "success" || r.status === "partial" || r.status === "not_covered";
    log("stamp-duty", ok, `status=${r.status} reason=${r.statusReason} totalPayable=${r.data?.breakup?.totalPayable ?? "n/a"}`);
    if (r.data?.breakup) {
      console.log(`    → stampDuty=${r.data.breakup.stampDuty} reg=${r.data.breakup.registrationFee} cess=${r.data.breakup.cess} bmvFloorApplied=${r.data.breakup.bmvFloorApplied}`);
    }
  } catch (e: any) {
    log("stamp-duty", false, `EXCEPTION: ${e?.message ?? e}`);
  }

  // 3) IGR Daily Bulletin — last 7 days, default Khordha
  try {
    const r = await igrDailyBulletinFetch({});
    const ok = r.status === "success" || r.status === "partial" || r.status === "not_covered";
    log("igr-daily-bulletin", ok, `status=${r.status} reason=${r.statusReason} days=${r.data?.days?.length ?? 0} totalDeeds=${r.data?.summary?.totalDeeds ?? "n/a"}`);
    if (r.data?.summary) {
      console.log(`    → totalDeeds=${r.data.summary.totalDeeds} totalConsideration=${r.data.summary.totalConsideration} avgPerDay=${r.data.summary.avgDeedsPerDay}`);
    }
  } catch (e: any) {
    log("igr-daily-bulletin", false, `EXCEPTION: ${e?.message ?? e}`);
  }

  console.log("=== done ===");
})();
