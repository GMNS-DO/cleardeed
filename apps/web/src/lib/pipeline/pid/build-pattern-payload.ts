/**
 * buildPatternPayload — pure mapper from fired insights to PID write inputs.
 *
 * Sub-plan B Task B.3. Given the list of fired insights + a context object,
 * produces the { candidates, events, facts } bundle that recordPatternFires
 * (Task B.4) writes to Supabase. Pure function — no I/O, no Supabase calls.
 *
 * Critical design decisions (from docs/superpowers/plans/2026-06-25-pid-pattern-detector-writes.md):
 * - AD-2: hash inputs are extracted from a normalized subset of RuleInput
 *   (ror.page2.selectedPlotNumber, ror.page1.khatiyanNumber, etc.), NOT from
 *   what each detector happened to inspect. ROR-INS-026 doesn't read plotNo
 *   itself; ROR-INS-040 doesn't read khataNo. The mapper reads them.
 * - AD-5: parser_uncertain evidenceStrength is filtered out for ALL stubs,
 *   not just ROR-INS-153.
 * - R5: positive severity is filtered out (not a fraud pattern).
 * - R6: ROR-INS-210 + ROR-INS-211 are NOT collapsed — different ruleIds
 *   produce different candidateKeys.
 *
 * candidateKey format: "<ruleId>:<sha256_first_16_hex_of_canonical_subject>"
 * The hash inputs are canonicalized (lowercase, trimmed, separators collapsed)
 * BEFORE hashing. Same subject + same rule → same candidateKey.
 */
import { createHash } from "node:crypto";
import {
  PATTERN_EVENT_TYPE,
  PATTERN_FACT_PREDICATE_PREFIX,
  type PatternCandidateInput,
  type EventInput,
  type FactAssertionInput,
} from "./types";
import type { Insight } from "@cleardeed/consumer-report-writer";

// Local copy of the rule input shape. The consumer-report-writer passes the
// full ConsumerReportGenInput parsed.data — but the mapper only needs the
// subset that's relevant to candidateKey hashing. We type it loosely to
// avoid dragging the entire schema tree into the PID layer's import graph.
type RuleInputSubset = {
  ror?: {
    page1?: {
      khatiyanNumber?: string | null;
      village?: string | null;
      tahasil?: string | null;
      tenant?: { name?: string | null } | null;
    } | null;
    page2?: {
      selectedPlotNumber?: string | null;
    } | null;
  } | null;
  claimedOwnerName?: string | null;
  tehsil?: string | null;
  village?: string | null;
  plotGPS?: { lat: number; lon: number } | { latitude: number; longitude: number } | null;
  ownerResidenceGPS?:
    | { lat: number; lon: number }
    | { latitude: number; longitude: number }
    | null;
};

// Default rule version. The actual rule file may carry its own version; we
// stamp the persisted row with this if the insight doesn't carry one.
// Insights in the current engine don't carry a `version` field — that's
// tracked separately in the RuleSchema. For now we default to "v1.5" to
// match CLAUDE.md (the V1.5 product line is the source of truth).
const DEFAULT_RULE_VERSION = "v1.5";

function canonicalize(s: string | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[|/\\]+/g, " ");
}

function gpsToString(
  g:
    | { lat: number; lon: number }
    | { latitude: number; longitude: number }
    | null
    | undefined,
): string {
  if (!g) return "";
  const lat = "lat" in g ? g.lat : g.latitude;
  const lon = "lon" in g ? g.lon : g.longitude;
  if (typeof lat !== "number" || typeof lon !== "number") return "";
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}

/**
 * Compute the deterministic candidateKey for one fired insight.
 * subjectHash is a 16-hex-char prefix of sha256(canonical_subject).
 * canonical_subject joins: plotNo | khataNo | tahasil | village | ownerName | subjectGPS
 * with "|" — empty fields are skipped.
 *
 * Exported so B.4 can pre-read the same key for idempotency.
 */
export function computePatternCandidateKey(
  insight: Pick<Insight, "ruleId">,
  input: RuleInputSubset,
): string {
  const r = input.ror;
  const plotNo = r?.page2?.selectedPlotNumber ?? null;
  const khataNo = r?.page1?.khatiyanNumber ?? null;
  const tahasil = r?.page1?.tahasil ?? input.tehsil ?? null;
  const village = r?.page1?.village ?? input.village ?? null;
  const ownerName = r?.page1?.tenant?.name ?? input.claimedOwnerName ?? null;
  const subjectGPS = input.plotGPS ?? input.ownerResidenceGPS ?? null;

  const canonical = [
    canonicalize(plotNo),
    canonicalize(khataNo),
    canonicalize(tahasil),
    canonicalize(village),
    canonicalize(ownerName),
    gpsToString(subjectGPS),
  ]
    .filter((s) => s.length > 0)
    .join("|");

  const subjectHash = createHash("sha256")
    .update(canonical)
    .digest("hex")
    .slice(0, 16);

  return `${insight.ruleId}:${subjectHash}`;
}

export interface BuildPatternPayloadInput {
  insights: readonly Insight[];
  ctx: {
    reportId: string;
    propertyId?: string | null;
    ruleInput: RuleInputSubset;
  };
}

export interface BuildPatternPayloadOutput {
  candidates: PatternCandidateInput[];
  events: EventInput[];
  facts: FactAssertionInput[];
}

export function buildPatternPayload(
  input: BuildPatternPayloadInput,
): BuildPatternPayloadOutput {
  const { insights, ctx } = input;
  const out: BuildPatternPayloadOutput = {
    candidates: [],
    events: [],
    facts: [],
  };

  // Dedupe candidateKeys within this report. Same ruleId firing multiple times
  // for the same subject (e.g. by re-evaluation within one pipeline run) emits
  // ONE candidate row with evidenceCount = N, but N events and N facts.
  const candidateByKey = new Map<
    string,
    { candidate: PatternCandidateInput; firstInsight: Insight }
  >();

  for (const insight of insights) {
    // Filter: positive severity is not a fraud pattern.
    if (insight.severity === "positive") continue;

    // Filter: stub detectors (parser_uncertain) — applies to ALL stubs, not
    // just ROR-INS-153. R5 from the pre-flight review.
    if (insight.evidenceStrength === "parser_uncertain") continue;

    const candidateKey = computePatternCandidateKey(insight, ctx.ruleInput);
    const patternFamily = ruleIdToFamily(insight.ruleId);

    const existing = candidateByKey.get(candidateKey);
    if (existing) {
      existing.candidate.evidenceCount += 1;
    } else {
      candidateByKey.set(candidateKey, {
        candidate: {
          candidateKey,
          patternFamily,
          candidateName: insight.headline,
          logicDescription: insight.body,
          status: "RAW_SIGNAL",
          evidenceCount: 1,
          ruleVersion: DEFAULT_RULE_VERSION,
          metadata: {
            ruleId: insight.ruleId,
            panel: insight.panel,
            source: insight.source,
            firstSeenAt: new Date().toISOString(),
          },
        },
        firstInsight: insight,
      });
    }

    // Events and facts are always per-firing — append-only.
    out.events.push({
      eventType: PATTERN_EVENT_TYPE,
      sourceId: "bhulekh", // all 5 patterns originate from bhulekh or eow — pick bhulekh as the default; metadata carries the true source
      reviewStatus: "unreviewed", // R7: pattern events deserve the lawyer review queue
      metadata: {
        ruleId: insight.ruleId,
        candidateKey,
        severity: insight.severity,
        panel: insight.panel,
        source: insight.source,
        reportId: ctx.reportId,
        issueLens: insight.issueLens,
        evidenceStrength: insight.evidenceStrength,
      },
    });

    out.facts.push({
      subjectType: "pattern",
      predicate: `${PATTERN_FACT_PREDICATE_PREFIX}${insight.ruleId}`,
      rawValue: insight.headline,
      normalizedValue: insight.severity,
      sourceId: "bhulekh",
      valueJson: {
        ruleId: insight.ruleId,
        candidateKey,
        severity: insight.severity,
        panel: insight.panel,
        headline: insight.headline,
        body: insight.body,
        actionItem: insight.actionItem,
        disclosure: insight.disclosure ?? null,
        source: insight.source,
        issueLens: insight.issueLens,
        evidenceStrength: insight.evidenceStrength,
      },
      metadata: {
        reportId: ctx.reportId,
        propertyId: ctx.propertyId ?? null,
        candidateKey,
      },
    });
  }

  out.candidates = Array.from(candidateByKey.values()).map((v) => v.candidate);

  return out;
}

function ruleIdToFamily(ruleId: string): string {
  // Stable mapping for the 5 documented patterns. Unknown ruleIds fall through
  // to a generic family so the corpus still groups them.
  const known: Record<string, string> = {
    "ROR-INS-180": "lease_resumption",
    "ROR-INS-210": "eow_blacklist_plot",
    "ROR-INS-211": "eow_blacklist_owner",
    "ROR-INS-026": "impersonation_residence_distance",
    "ROR-INS-153": "industrial_zone_residential_sale",
    "ROR-INS-040": "subdivided_plot_no_bda_approval",
  };
  return known[ruleId] ?? "unmapped";
}
