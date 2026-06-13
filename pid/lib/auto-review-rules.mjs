// Pure rule functions for tier-0 auto-review. Each takes (row, context) and
// returns {match, decision, reason} or null. No I/O, no side effects.
//
// These are DOWNGRADES only. No rule returns "approved". The single approved
// path is the LLM tier-1 path in pid/cli/auto_approve_pattern_examples.mjs,
// and that path enforces confidence >= 0.9 and a 1-per-family cap.

import { POLICY } from "./auto-review-policy.mjs";

const D_038_BOILERPLATE_PREDICATES = new Set([
  "portal_menu_label",
  "page_title",
  "navigation_label",
  "form_field_label",
  "required_documents_list",
  "service_timeline_entry",
  "search_help_text",
  "page_footer",
  "page_brand",
  "header_artifact",
]);

const D_042_DUPLICATE_PREDICATES = new Set([
  "duplicate_text_signal",
  "boilerplate_text_signal",
  "duplicate_kw_signal",
]);

const LOW_CONFIDENCE_THRESHOLD = 0.5;

function getPolicy(targetType, policyKey) {
  return POLICY[targetType]?.[policyKey] || null;
}

export function isLowConfidenceFact(fact) {
  if (!fact || typeof fact.confidence !== "number") return null;
  if (fact.confidence >= LOW_CONFIDENCE_THRESHOLD) return null;
  const policy = getPolicy("facts", "extraction_error");
  if (!policy) return null;
  return {
    match: true,
    decision: policy.decision,
    reason: `fact.confidence=${fact.confidence} below ${LOW_CONFIDENCE_THRESHOLD} (D-004)`,
    reviewer: policy.reviewer,
    policy_key: "extraction_error",
  };
}

export function isBoilerplateFact(fact) {
  if (!fact) return null;
  if (D_038_BOILERPLATE_PREDICATES.has(fact.predicate)) {
    const policy = getPolicy("facts", "benign_boilerplate");
    return {
      match: true,
      decision: policy.decision,
      reason: `predicate "${fact.predicate}" matches D-038 boilerplate set`,
      reviewer: policy.reviewer,
      policy_key: "benign_boilerplate",
    };
  }
  if (fact.metadata?.duplicate_of || D_042_DUPLICATE_PREDICATES.has(fact.predicate)) {
    const policy = getPolicy("facts", "benign_duplicate");
    return {
      match: true,
      decision: policy.decision,
      reason: `duplicate signal present (D-042)`,
      reviewer: policy.reviewer,
      policy_key: "benign_duplicate",
    };
  }
  return null;
}

export function isUnderEvidencedFact(fact, context = {}) {
  if (!fact) return null;
  const hasArtifact = Boolean(fact.artifact_id);
  const hasSource = Boolean(fact.source_id);
  const crossSourceJoin = Boolean(context.cross_source_join);
  if (hasArtifact || hasSource || crossSourceJoin) return null;
  const policy = getPolicy("facts", "lead_only_under_evidenced");
  return {
    match: true,
    decision: policy.decision,
    reason: "no supporting artifact, no source, no cross-source join",
    reviewer: policy.reviewer,
    policy_key: "lead_only_under_evidenced",
  };
}

export function evaluateFact(fact, context = {}) {
  return (
    isLowConfidenceFact(fact)
    || isBoilerplateFact(fact)
    || isUnderEvidencedFact(fact, context)
    || null
  );
}

export function isLowConfidenceEvent(event) {
  if (!event || typeof event.confidence !== "number") return null;
  if (event.confidence >= LOW_CONFIDENCE_THRESHOLD) return null;
  const policy = getPolicy("events", "extraction_error_low_confidence");
  return {
    match: true,
    decision: policy.decision,
    reason: `event.confidence=${event.confidence} below ${LOW_CONFIDENCE_THRESHOLD} (D-004)`,
    reviewer: policy.reviewer,
    policy_key: "extraction_error_low_confidence",
  };
}

export function isUnderEvidencedEvent(event, context = {}) {
  if (!event) return null;
  const hasArtifact = Boolean(event.artifact_id);
  const hasFactJoin = Boolean(context.fact_join);
  if (hasArtifact || hasFactJoin) return null;
  const policy = getPolicy("events", "lead_only_under_evidenced");
  return {
    match: true,
    decision: policy.decision,
    reason: "event has no artifact and no fact join",
    reviewer: policy.reviewer,
    policy_key: "lead_only_under_evidenced",
  };
}

export function isTitleFlowTextLeakEvent(event) {
  if (!event) return null;
  const summary = event.event_summary || "";
  if (event.event_type === "orera_title_flow" && /poa|gpa|power of attorney/i.test(summary) && !event.document_id) {
    const policy = getPolicy("events", "extraction_error_low_confidence");
    return {
      match: true,
      decision: policy.decision,
      reason: "title-flow text leak with no document_id",
      reviewer: policy.reviewer,
      policy_key: "extraction_error_low_confidence",
    };
  }
  return null;
}

export function evaluateEvent(event, context = {}) {
  return (
    isLowConfidenceEvent(event)
    || isTitleFlowTextLeakEvent(event)
    || isUnderEvidencedEvent(event, context)
    || null
  );
}

export function isUnderEvidencedCandidate(candidate) {
  if (!candidate) return null;
  const evidenceCount = candidate.evidence_count || 0;
  const hasArtifact = (candidate.supporting_artifact_ids || []).length > 0;
  const hasEvents = (candidate.supporting_event_ids || []).length > 0;
  if (evidenceCount > 1) return null;
  if (hasArtifact || hasEvents) return null;
  const policy = getPolicy("pattern_candidates", "lead_only_under_evidenced");
  return {
    match: true,
    decision: policy.decision,
    reason: `evidence_count=${evidenceCount} and no supporting artifacts/events`,
    reviewer: policy.reviewer,
    policy_key: "lead_only_under_evidenced",
  };
}

export function isNoEvidenceCandidate(candidate) {
  if (!candidate) return null;
  const hasArtifact = (candidate.supporting_artifact_ids || []).length > 0;
  const hasEvents = (candidate.supporting_event_ids || []).length > 0;
  if (hasArtifact || hasEvents) return null;
  const policy = getPolicy("pattern_candidates", "rejected_no_evidence");
  return {
    match: true,
    decision: policy.decision,
    reason: "no supporting artifact and no supporting event",
    reviewer: policy.reviewer,
    policy_key: "rejected_no_evidence",
  };
}

export function evaluateCandidate(candidate) {
  return (
    isNoEvidenceCandidate(candidate)
    || isUnderEvidencedCandidate(candidate)
    || null
  );
}

export const ALL_RULES = {
  fact: [
    isLowConfidenceFact,
    isBoilerplateFact,
    isUnderEvidencedFact,
  ],
  event: [
    isLowConfidenceEvent,
    isTitleFlowTextLeakEvent,
    isUnderEvidencedEvent,
  ],
  pattern_candidate: [
    isNoEvidenceCandidate,
    isUnderEvidencedCandidate,
  ],
};

export function evaluateRow(targetType, row, context = {}) {
  if (targetType === "fact") return evaluateFact(row, context);
  if (targetType === "event") return evaluateEvent(row, context);
  if (targetType === "pattern_candidate") return evaluateCandidate(row, context);
  return null;
}
