/**
 * recordPatternFires — orchestrator for the pattern-detector persistence path.
 *
 * Sub-plan B Task B.4. Given the list of fired insights + a context object,
 * builds the write bundle via buildPatternPayload (B.3) and persists it to
 * Supabase via pidInsertPatternCandidate / pidUpsertPatternCandidateByKey /
 * pidInsertEvent / pidInsertFactAssertion.
 *
 * Kill switch: respects process.env.PID_RECORDING_ENABLED — same env var as
 * Sub-plan A's recordFetchResult. Default OFF. When OFF, returns null
 * without writing anything.
 *
 * Idempotency: pre-reads pid_pattern_candidates for each candidateKey to
 * decide insert vs upsert. singleInsert swallows Supabase error codes
 * (deliberately — see Sub-plan A's client.ts), so we cannot rely on a
 * unique-constraint violation to trigger the upsert path. The pre-read
 * is one round-trip per unique candidate; with the candidate_key unique
 * index, each lookup is <5ms.
 *
 * Non-blocking: any single Supabase failure is logged + skipped. The loop
 * continues. recordPatternFires NEVER throws out.
 */
import { supabaseAdmin } from "../../db";
import {
  buildPatternPayload,
  computePatternCandidateKey,
  type BuildPatternPayloadInput,
} from "./build-pattern-payload";
import {
  pidInsertPatternCandidate,
  pidUpsertPatternCandidateByKey,
  pidInsertEvent,
  pidInsertFactAssertion,
} from "./client";
import type { Insight } from "@cleardeed/consumer-report-writer";

export interface RecordPatternFiresInput {
  insights: readonly Insight[];
  ctx: {
    reportId: string;
    propertyId?: string | null;
    ruleInput: BuildPatternPayloadInput["ctx"]["ruleInput"];
  };
}

export interface RecordPatternFiresResult {
  candidateIds: string[];
  eventIds: string[];
  factIds: string[];
  /** true if every operation succeeded; false if any was skipped/failed. */
  ok: boolean;
}

export async function recordPatternFires(
  input: RecordPatternFiresInput,
): Promise<RecordPatternFiresResult | null> {
  // Kill switch — same env var as Sub-plan A's recordFetchResult.
  if (process.env.PID_RECORDING_ENABLED !== "true") {
    return null;
  }

  const { insights, ctx } = input;
  if (insights.length === 0) return null;

  const bundle = buildPatternPayload({ insights, ctx });
  if (bundle.candidates.length === 0) {
    return null;
  }

  // Pre-read: which candidateKeys already exist?
  // We only need to know existence — the upsert carries the new payload.
  const existingKeys = await preReadExistingCandidateKeys(
    bundle.candidates.map((c) => c.candidateKey),
  );

  const candidateIds: string[] = [];
  const eventIds: string[] = [];
  const factIds: string[] = [];
  let ok = true;

  for (const candidate of bundle.candidates) {
    try {
      const id = existingKeys.has(candidate.candidateKey)
        ? await pidUpsertPatternCandidateByKey(candidate)
        : await pidInsertPatternCandidate(candidate);
      if (id) {
        candidateIds.push(id);
      } else {
        // Insert returned null. It might be a unique conflict (we lost a race
        // with another report firing the same rule on the same subject).
        // Fall through to upsert, which is idempotent.
        const upsertId = await pidUpsertPatternCandidateByKey(candidate);
        if (upsertId) candidateIds.push(upsertId);
        else ok = false;
      }
    } catch (err) {
      console.warn(
        `[pid/pattern] candidate ${candidate.candidateKey} threw: ${(err as Error).message}`,
      );
      ok = false;
    }
  }

  for (const event of bundle.events) {
    try {
      const id = await pidInsertEvent(event);
      if (id) eventIds.push(id);
      else ok = false;
    } catch (err) {
      console.warn(
        `[pid/pattern] event ${event.metadata?.candidateKey ?? "?"} threw: ${(err as Error).message}`,
      );
      ok = false;
    }
  }

  for (const fact of bundle.facts) {
    try {
      const id = await pidInsertFactAssertion(fact);
      if (id) factIds.push(id);
      else ok = false;
    } catch (err) {
      console.warn(
        `[pid/pattern] fact ${fact.predicate} threw: ${(err as Error).message}`,
      );
      ok = false;
    }
  }

  return { candidateIds, eventIds, factIds, ok };
}

/**
 * Look up which of the given candidateKeys already exist in pid_pattern_candidates.
 * Returns a Set containing the keys that exist. Returns an empty set on any
 * error — we never want a pre-read failure to block the write path.
 *
 * The candidate_key column has a unique index from migration 006, so this
 * lookup is fast (<5ms per key in practice).
 */
async function preReadExistingCandidateKeys(
  keys: string[],
): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("pid_pattern_candidates")
      .select("candidate_key")
      .in("candidate_key", keys);
    if (error || !data) {
      console.warn(`[pid/pattern] pre-read failed: ${error?.message ?? "no data"}`);
      return new Set();
    }
    return new Set(
      (data as Array<{ candidate_key: string }>).map((r) => r.candidate_key),
    );
  } catch (err) {
    console.warn(`[pid/pattern] pre-read threw: ${(err as Error).message}`);
    return new Set();
  }
}

// Re-export the candidateKey function for callers that want to compute it
// outside the orchestrator (e.g. logging).
export { computePatternCandidateKey };
