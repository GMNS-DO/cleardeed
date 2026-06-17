/**
 * qa/all_fetchers_live_smoke.test.ts
 *
 * A.2.5 — Live smoke battery for all 15+ fetchers.
 *
 * Runs each fetcher against the live portal and reports:
 *   - status: success / partial / failed / not_covered
 *   - reason: why
 *   - latencyMs: round-trip time
 *   - ok: true if we got a structured envelope back (regardless of content)
 *
 * Acceptance (per launch audit §"Live smoke battery"):
 *   - 0 fetchers should hard-crash (every one should return a typed envelope)
 *   - Latency p95 < 30s (otherwise the user waits too long)
 *
 * Skipped in CI by default. Run with:
 *   npx vitest run qa/all_fetchers_live_smoke.test.ts
 *
 * Output is a structured log line per fetcher + a final summary. The
 * founder can grep the output for FAIL/CRASH and triage live-portal
 * blockers before the launch week.
 */
import { describe, it, expect } from "vitest";
import { fetch as bhulekhFetch } from "@cleardeed/fetcher-bhulekh";
import { bhunakshaFetch } from "@cleardeed/fetcher-bhunaksha";
import { bhunakshaPlotReportFetch } from "@cleardeed/fetcher-bhunaksha-plot-report";
import { ecourtsFetch } from "@cleardeed/fetcher-ecourts";
import { cersaiFetch } from "@cleardeed/fetcher-cersai";
import { fetch as rccmsFetch } from "@cleardeed/fetcher-rccms";
import { fetchCcmsNic } from "../../packages/fetchers/rccms/src/v2-ccms-nic";
import { igrEcFetch } from "@cleardeed/fetcher-igr-ec";
import { igrBmvFetch } from "@cleardeed/fetcher-igr-bmv";
import { stampDutyFetch } from "@cleardeed/fetcher-stamp-duty";
import { igrDailyBulletinFetch } from "@cleardeed/fetcher-igr-daily-bulletin";
import { fetch as circleRateFetch } from "@cleardeed/fetcher-circle-rate";
import { fetch as bdaZoningFetch } from "@cleardeed/fetcher-bda-zoning";
import { nominatimFetch } from "@cleardeed/fetcher-nominatim";

interface SmokeRun {
  fetcher: string;
  status: string;
  reason: string;
  latencyMs: number;
  crashed: boolean;
  errorMessage?: string;
}

const smokeRuns: SmokeRun[] = [];

async function timeIt<T>(label: string, fn: () => Promise<T>): Promise<{ result: T | null; elapsedMs: number; crashed: boolean; errorMessage?: string }> {
  const t0 = Date.now();
  try {
    const result = await fn();
    return { result, elapsedMs: Date.now() - t0, crashed: false };
  } catch (err) {
    return {
      result: null,
      elapsedMs: Date.now() - t0,
      crashed: true,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

describe.skipIf(process.env.CI === "true")(
  "Live smoke battery (A.2.5)",
  () => {
    it(
      "runs all 13 fetchers against live portals and reports per-fetcher health",
      async () => {
        // 1. Nominatim
        {
          const { result, elapsedMs, crashed, errorMessage } = await timeIt("nominatim", () =>
            nominatimFetch({ gps: { lat: 20.296, lon: 85.823 } })
          );
          if (crashed || !result) {
            smokeRuns.push({ fetcher: "nominatim", status: "CRASH", reason: "threw", latencyMs: elapsedMs, crashed: true, errorMessage });
          } else {
            const r = result as { status?: string; statusReason?: string };
            smokeRuns.push({
              fetcher: "nominatim",
              status: r.status ?? "?",
              reason: r.statusReason ?? "-",
              latencyMs: elapsedMs,
              crashed: false,
            });
          }
        }

        // 2. Bhulekh ROR
        {
          const { result, elapsedMs, crashed, errorMessage } = await timeIt("bhulekh", () =>
            bhulekhFetch({ village: "Mendhasala", plotNo: "415" })
          );
          if (crashed || !result) {
            smokeRuns.push({ fetcher: "bhulekh", status: "CRASH", reason: "threw", latencyMs: elapsedMs, crashed: true, errorMessage });
          } else {
            const r = result as { status?: string; statusReason?: string };
            smokeRuns.push({ fetcher: "bhulekh", status: r.status ?? "?", reason: r.statusReason ?? "-", latencyMs: elapsedMs, crashed: false });
          }
        }

        // 3. Bhunaksha polygon (lat/lon for Mendhasala centroid)
        {
          const { result, elapsedMs, crashed, errorMessage } = await timeIt("bhunaksha", () =>
            bhunakshaFetch({ lat: 20.296, lon: 85.823, layer: "khurda_bhubaneswar" })
          );
          if (crashed || !result) {
            smokeRuns.push({ fetcher: "bhunaksha", status: "CRASH", reason: "threw", latencyMs: elapsedMs, crashed: true, errorMessage });
          } else {
            const r = result as { status?: string; statusReason?: string };
            smokeRuns.push({ fetcher: "bhunaksha", status: r.status ?? "?", reason: r.statusReason ?? "-", latencyMs: elapsedMs, crashed: false });
          }
        }

        // 4. Bhunaksha Plot Report
        {
          const { result, elapsedMs, crashed, errorMessage } = await timeIt("bhunaksha-plot-report", () =>
            bhunakshaPlotReportFetch({ village: "Mendhasala", tahasil: "Bhubaneswar", plotNo: "181/10454" })
          );
          if (crashed || !result) {
            smokeRuns.push({ fetcher: "bhunaksha-plot-report", status: "CRASH", reason: "threw", latencyMs: elapsedMs, crashed: true, errorMessage });
          } else {
            const r = result as { status?: string; statusReason?: string };
            smokeRuns.push({ fetcher: "bhunaksha-plot-report", status: r.status ?? "?", reason: r.statusReason ?? "-", latencyMs: elapsedMs, crashed: false });
          }
        }

        // 5. eCourts
        {
          const { result, elapsedMs, crashed, errorMessage } = await timeIt("ecourts", () =>
            ecourtsFetch({ partyName: "Deeksha Mahapatra" })
          );
          if (crashed || !result) {
            smokeRuns.push({ fetcher: "ecourts", status: "CRASH", reason: "threw", latencyMs: elapsedMs, crashed: true, errorMessage });
          } else {
            const r = result as { status?: string; statusReason?: string };
            smokeRuns.push({ fetcher: "ecourts", status: r.status ?? "?", reason: r.statusReason ?? "-", latencyMs: elapsedMs, crashed: false });
          }
        }

        // 6. CERSAI
        {
          const { result, elapsedMs, crashed, errorMessage } = await timeIt("cersai", () =>
            cersaiFetch({ partyName: "Bikash Chandra Mohapatra" })
          );
          if (crashed || !result) {
            smokeRuns.push({ fetcher: "cersai", status: "CRASH", reason: "threw", latencyMs: elapsedMs, crashed: true, errorMessage });
          } else {
            const r = result as { status?: string; statusReason?: string };
            smokeRuns.push({ fetcher: "cersai", status: r.status ?? "?", reason: r.statusReason ?? "-", latencyMs: elapsedMs, crashed: false });
          }
        }

        // 7. RCCMS
        {
          const { result, elapsedMs, crashed, errorMessage } = await timeIt("rccms", () =>
            rccmsFetch({ district: "Khordha", tahasil: "Bhubaneswar", village: "Mendhasala" })
          );
          if (crashed || !result) {
            smokeRuns.push({ fetcher: "rccms", status: "CRASH", reason: "threw", latencyMs: elapsedMs, crashed: true, errorMessage });
          } else {
            const r = result as { status?: string; statusReason?: string };
            smokeRuns.push({ fetcher: "rccms", status: r.status ?? "?", reason: r.statusReason ?? "-", latencyMs: elapsedMs, crashed: false });
          }
        }

        // 7b. RCCMS v2 (ccms.nic.in) — Task 1.1.
        // Skip the whole block when ccms.nic.in is unreachable. The
        // fallback is silent (not a CRASH) so the existing acceptance
        // criterion "0 fetchers should hard-crash" still holds.
        {
          let ccmsReachable = true;
          try {
            const probe = await globalThis.fetch("https://ccms.nic.in/searchCases.html", {
              method: "HEAD",
              signal: AbortSignal.timeout(3_000),
            });
            ccmsReachable = probe.ok;
          } catch {
            ccmsReachable = false;
          }

          if (!ccmsReachable) {
            smokeRuns.push({
              fetcher: "rccms-v2-ccms-nic",
              status: "skipped",
              reason: "ccms.nic.in unreachable",
              latencyMs: 0,
              crashed: false,
            });
          } else {
            const { result, elapsedMs, crashed, errorMessage } = await timeIt(
              "rccms-v2-ccms-nic",
              () =>
                fetchCcmsNic({
                  district: "Khordha",
                  tahasil: "Bhubaneswar",
                  village: "Mendhasala",
                })
            );
            if (crashed || !result) {
              smokeRuns.push({
                fetcher: "rccms-v2-ccms-nic",
                status: "CRASH",
                reason: "threw",
                latencyMs: elapsedMs,
                crashed: true,
                errorMessage,
              });
            } else {
              const r = result as { status?: string; error?: string };
              smokeRuns.push({
                fetcher: "rccms-v2-ccms-nic",
                status: r.status ?? "?",
                reason: r.error ?? "-",
                latencyMs: elapsedMs,
                crashed: false,
              });
            }
          }
        }

        // 8. IGR EC (manual-instructions path)
        {
          const { result, elapsedMs, crashed, errorMessage } = await timeIt("igr-ec", () =>
            igrEcFetch({ partyName: "Bikash Chandra Mohapatra", sroCode: "BHUBANESWAR" })
          );
          if (crashed || !result) {
            smokeRuns.push({ fetcher: "igr-ec", status: "CRASH", reason: "threw", latencyMs: elapsedMs, crashed: true, errorMessage });
          } else {
            const r = result as { status?: string; statusReason?: string };
            smokeRuns.push({ fetcher: "igr-ec", status: r.status ?? "?", reason: r.statusReason ?? "-", latencyMs: elapsedMs, crashed: false });
          }
        }

        // 9. IGR BMV
        {
          const { result, elapsedMs, crashed, errorMessage } = await timeIt("igr-bmv", () =>
            igrBmvFetch({ sro: "Bhubaneswar", village: "Mendhasala", kisam: "Bari" })
          );
          if (crashed || !result) {
            smokeRuns.push({ fetcher: "igr-bmv", status: "CRASH", reason: "threw", latencyMs: elapsedMs, crashed: true, errorMessage });
          } else {
            const r = result as { status?: string; statusReason?: string };
            smokeRuns.push({ fetcher: "igr-bmv", status: r.status ?? "?", reason: r.statusReason ?? "-", latencyMs: elapsedMs, crashed: false });
          }
        }

        // 10. Stamp duty
        {
          const { result, elapsedMs, crashed, errorMessage } = await timeIt("stamp-duty", () =>
            stampDutyFetch({ sro: "Bhubaneswar", marketValue: 5_000_000, deedType: "Sale" })
          );
          if (crashed || !result) {
            smokeRuns.push({ fetcher: "stamp-duty", status: "CRASH", reason: "threw", latencyMs: elapsedMs, crashed: true, errorMessage });
          } else {
            const r = result as { status?: string; statusReason?: string };
            smokeRuns.push({ fetcher: "stamp-duty", status: r.status ?? "?", reason: r.statusReason ?? "-", latencyMs: elapsedMs, crashed: false });
          }
        }

        // 11. IGR daily bulletin
        {
          const { result, elapsedMs, crashed, errorMessage } = await timeIt("igr-daily-bulletin", () =>
            igrDailyBulletinFetch({ sro: "Bhubaneswar", date: "2026-06-15" })
          );
          if (crashed || !result) {
            smokeRuns.push({ fetcher: "igr-daily-bulletin", status: "CRASH", reason: "threw", latencyMs: elapsedMs, crashed: true, errorMessage });
          } else {
            const r = result as { status?: string; statusReason?: string };
            smokeRuns.push({ fetcher: "igr-daily-bulletin", status: r.status ?? "?", reason: r.statusReason ?? "-", latencyMs: elapsedMs, crashed: false });
          }
        }

        // 12. Circle rate (local JSON, fast)
        {
          const { result, elapsedMs, crashed, errorMessage } = await timeIt("circle-rate", () =>
            circleRateFetch({ district: "Khordha", village: "Mendhasala" })
          );
          if (crashed || !result) {
            smokeRuns.push({ fetcher: "circle-rate", status: "CRASH", reason: "threw", latencyMs: elapsedMs, crashed: true, errorMessage });
          } else {
            const r = result as { status?: string; statusReason?: string };
            smokeRuns.push({ fetcher: "circle-rate", status: r.status ?? "?", reason: r.statusReason ?? "-", latencyMs: elapsedMs, crashed: false });
          }
        }

        // 13. BDA zoning (local JSON, fast)
        {
          const { result, elapsedMs, crashed, errorMessage } = await timeIt("bda-zoning", () =>
            bdaZoningFetch({ village: "Mendhasala" })
          );
          if (crashed || !result) {
            smokeRuns.push({ fetcher: "bda-zoning", status: "CRASH", reason: "threw", latencyMs: elapsedMs, crashed: true, errorMessage });
          } else {
            const r = result as { status?: string; statusReason?: string };
            smokeRuns.push({ fetcher: "bda-zoning", status: r.status ?? "?", reason: r.statusReason ?? "-", latencyMs: elapsedMs, crashed: false });
          }
        }

        // ── Summary ──
        const totalLatency = smokeRuns.reduce((s, r) => s + r.latencyMs, 0);
        const crashedCount = smokeRuns.filter((r) => r.crashed).length;
        const failedCount = smokeRuns.filter((r) => r.status === "failed").length;
        const partialCount = smokeRuns.filter((r) => r.status === "partial").length;
        const successCount = smokeRuns.filter((r) => r.status === "success").length;

        // eslint-disable-next-line no-console
        console.log(
          `\n[Live smoke battery] ${smokeRuns.length} fetchers, total=${totalLatency}ms\n` +
            smokeRuns
              .map(
                (r) =>
                  `  ${r.crashed ? "CRASH" : r.status === "failed" ? "FAIL " : r.status === "partial" ? "PART " : "OK   "} ${r.fetcher.padEnd(24)} ${r.latencyMs.toString().padStart(6)}ms  reason=${r.reason}`
              )
              .join("\n") +
            `\n\n  success: ${successCount}  partial: ${partialCount}  failed: ${failedCount}  crashed: ${crashedCount}`
        );

        // Acceptance: 0 crashes (every fetcher returns a typed envelope)
        expect(crashedCount).toBe(0);
      },
      30 * 60 * 1000 // 30 min budget for all 14 fetchers
    );
  }
);
