// V5c live smoke — runs all 3 fetchers against the live IGR Odisha portal.
import { publicDashboardFetch } from "../../packages/fetchers/public-dashboard/src/index.ts";
import { govtFeeFetch } from "../../packages/fetchers/govt-fee/src/index.ts";
import { igrCertifiedCopyFetch } from "../../packages/fetchers/igr-certified-copy/src/index.ts";

const log = (label: string, ok: boolean, detail: string) =>
  console.log(`[${ok ? "OK" : "FAIL"}] ${label} — ${detail}`);

(async () => {
  console.log("=== Sprint V5c — live smoke against igrodisha.gov.in ===");
  console.log(`Date: ${new Date().toISOString()}`);

  // 1) Public Dashboard — server-rendered page-alive probe
  try {
    const r = await publicDashboardFetch({});
    const ok = r.status === "success" || r.status === "partial" || r.status === "not_covered";
    log("public-dashboard", ok, `status=${r.status} reason=${r.statusReason} pageIsLive=${r.data?.pageIsLive ?? "n/a"}`);
    if (r.data?.pageIsLive) {
      console.log(`    → page=${r.data.pageUrl} notes=${(r.data.notes ?? []).length} note(s)`);
    }
  } catch (e: any) {
    log("public-dashboard", false, `EXCEPTION: ${e?.message ?? e}`);
  }

  // 2) Govt Fee — permanent typed cache (no network)
  try {
    const r = await govtFeeFetch({ deedCategory: "Sale" });
    const ok = r.status === "success" || r.status === "partial" || r.status === "not_covered";
    log("govt-fee", ok, `status=${r.status} reason=${r.statusReason} matched=${r.data?.matchedDeedFee?.category ?? "null"}`);
    if (r.data?.matchedDeedFee) {
      const m = r.data.matchedDeedFee;
      console.log(`    → ${m.category}: stampPct=${m.stampPct} regPct=${m.registrationFeePct} minStamp=₹${m.minStampINR}`);
    }
  } catch (e: any) {
    log("govt-fee", false, `EXCEPTION: ${e?.message ?? e}`);
  }

  // 3) IGR Certified Copy — Phase 1 page probe + manual-instructions
  try {
    const r = await igrCertifiedCopyFetch({});
    const ok = r.status === "success" || r.status === "partial" || r.status === "not_covered";
    log("igr-certified-copy", ok, `status=${r.status} reason=${r.statusReason} pageIsLive=${r.data?.pageIsLive ?? "n/a"}`);
    if (r.data?.section57Note) {
      console.log(`    → §57 note length: ${r.data.section57Note.length} chars`);
      console.log(`    → manual-instructions steps: ${r.data.manualInstructions?.steps?.length ?? 0}`);
      console.log(`    → estimated fee: ₹${r.data.manualInstructions?.estimatedFeeINR ?? "n/a"}`);
    }
  } catch (e: any) {
    log("igr-certified-copy", false, `EXCEPTION: ${e?.message ?? e}`);
  }

  console.log("=== done ===");
})();
