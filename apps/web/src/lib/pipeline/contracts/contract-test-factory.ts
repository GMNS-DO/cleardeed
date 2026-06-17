/**
 * Per-source contract test factory — Phase 0.2.
 *
 * Runs the 3 bars against any fetcher and returns a typed verdict:
 *   - Bar 1 (parity):          fetcher must fire on the first plot
 *   - Bar 2 (fresh plots):     fetcher must fire on the next 3 plots
 *   - Bar 3 (failure honesty): fetcher must NOT fire on the 5th plot
 *                              (a known-broken plot); throwing is honest
 *
 * Bar 3 is skipped when fewer than 5 plot ids are supplied. The factory
 * reuses `isSourceFired` from ./fire as the single source of truth for
 * "did the source actually fire?".
 */
import { isSourceFired, type SourceId } from "./fire";

export type BarResult = "pass" | "fail" | "skipped";
export interface BarReport {
  bar1: BarResult;
  bar2: BarResult;
  bar3: BarResult;
  details: string[];
}
export type Fetcher = (input: string) => Promise<unknown>;

const HONEST_FAILURE_REASONS = new Set([
  "no_data", "source_down", "invalid_input", "parse_error", "no_schema", "skipped_dormant",
]);

export async function runBar1Bar2Bar3(
  sourceId: SourceId,
  plotIds: string[],
  fetcher: Fetcher,
): Promise<BarReport> {
  const details: string[] = [];

  const bar1 = await expectFire(fetcher, plotIds[0], "bar1", details, sourceId);

  const bar2Plots = plotIds.slice(1, 4);
  let bar2: BarResult = "skipped";
  if (bar2Plots.length > 0) {
    const results = await Promise.all(
      bar2Plots.map((p) => expectFire(fetcher, p, `bar2/${p}`, details, sourceId)),
    );
    bar2 = results.every((r) => r === "pass") ? "pass" : "fail";
  }

  let bar3: BarResult = "skipped";
  if (plotIds[4] !== undefined) {
    try {
      const result = await fetcher(plotIds[4]);
      const fired = isSourceFired(sourceId, result);
      if (fired.fired) {
        details.push(`bar3: fired=true on known-broken plot (dishonest)`);
        bar3 = "fail";
      } else if (HONEST_FAILURE_REASONS.has(fired.reason)) {
        details.push(`bar3: ${fired.reason} (honest)`);
        bar3 = "pass";
      } else {
        details.push(`bar3: unexpected reason ${fired.reason}`);
        bar3 = "fail";
      }
    } catch (e) {
      // Throwing on a known-broken plot is also honest.
      details.push(`bar3: threw ${(e as Error).message} (honest)`);
      bar3 = "pass";
    }
  }

  return { bar1, bar2, bar3, details };
}

async function expectFire(
  fetcher: Fetcher,
  plotId: string | undefined,
  label: string,
  details: string[],
  sourceId: SourceId,
): Promise<BarResult> {
  if (plotId === undefined) {
    details.push(`${label}: skipped (no plot id)`);
    return "skipped";
  }
  try {
    const result = await fetcher(plotId);
    const fired = isSourceFired(sourceId, result);
    if (fired.fired) {
      details.push(`${label}: fired=true`);
      return "pass";
    }
    details.push(`${label}: ${fired.reason} (expected fire)`);
    return "fail";
  } catch (e) {
    details.push(`${label}: threw ${(e as Error).message}`);
    return "fail";
  }
}
