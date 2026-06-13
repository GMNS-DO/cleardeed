// Central auto-review policy. Single source of truth for the (target_type,
// decision) -> (tier, guard, reviewer) mapping. Phase 7 guardrail test #5
// asserts tier0_rule rows do NOT contain "approved".
//
// INVARIANTS (enforced by Phase 7 tests):
// 1. No tier0_rule row has decision === "approved".
// 2. tier0_rule decisions are downgrades only: lead_only | benign |
//    extraction_error | rejected.
// 3. tier1_llm rows may include "approved" but only for pattern_candidate
//    examples (the only place a single LLM can mark a row approved).
// 4. tier1_llm rows that propose "approved" must enforce the
//    autoApproveCapPerFamily cap (checked in the CLI, not here, because
//    the cap is computed against the live reviews.jsonl).

import { PID_LLM_DEFAULTS } from "../config.js";

export const TIER0_RULE_DECISIONS = new Set([
  "lead_only",
  "benign",
  "extraction_error",
  "rejected",
]);

export const POLICY = {
  facts: {
    extraction_error: {
      tier: "tier0_rule",
      decision: "extraction_error",
      guard: "confidence < 0.5 (D-004)",
      reviewer: `${PID_LLM_DEFAULTS.tier0ReviewerPrefix}:low_confidence`,
    },
    benign_boilerplate: {
      tier: "tier0_rule",
      decision: "benign",
      guard: "predicate matches D-038 boilerplate set",
      reviewer: `${PID_LLM_DEFAULTS.tier0ReviewerPrefix}:boilerplate`,
    },
    benign_duplicate: {
      tier: "tier0_rule",
      decision: "benign",
      guard: "metadata.duplicate_of is set (D-042)",
      reviewer: `${PID_LLM_DEFAULTS.tier0ReviewerPrefix}:duplicate`,
    },
    lead_only_under_evidenced: {
      tier: "tier0_rule",
      decision: "lead_only",
      guard: "no cross-source signal and no supporting artifact/event",
      reviewer: `${PID_LLM_DEFAULTS.tier0ReviewerPrefix}:under_evidenced`,
    },
  },
  events: {
    lead_only_under_evidenced: {
      tier: "tier0_rule",
      decision: "lead_only",
      guard: "no supporting artifact and no fact join",
      reviewer: `${PID_LLM_DEFAULTS.tier0ReviewerPrefix}:under_evidenced`,
    },
    extraction_error_low_confidence: {
      tier: "tier0_rule",
      decision: "extraction_error",
      guard: "confidence < 0.5 (D-004)",
      reviewer: `${PID_LLM_DEFAULTS.tier0ReviewerPrefix}:low_confidence`,
    },
  },
  pattern_candidates: {
    lead_only_under_evidenced: {
      tier: "tier0_rule",
      decision: "lead_only",
      guard: "evidence_count <= 1 and no supporting artifact and no supporting event",
      reviewer: `${PID_LLM_DEFAULTS.tier0ReviewerPrefix}:under_evidenced`,
    },
    rejected_no_evidence: {
      tier: "tier0_rule",
      decision: "rejected",
      guard: "no supporting artifact AND no supporting event AND no cross-source fact join",
      reviewer: `${PID_LLM_DEFAULTS.tier0ReviewerPrefix}:no_evidence`,
    },
    approved_by_llm: {
      tier: "tier1_llm",
      decision: "approved",
      guard: `confidence >= ${PID_LLM_DEFAULTS.confidenceThreshold} and evidence_count >= 3 and pattern_family in active families and family has < ${PID_LLM_DEFAULTS.autoApproveCapPerFamily} prior auto-approves`,
      reviewer: `${PID_LLM_DEFAULTS.tier1ReviewerPrefix}:claude-opus-4-7`,
    },
  },
  title_chain_packets: {
    propose_needs_followup: {
      tier: "tier1_llm",
      decision: "needs_followup",
      guard: `confidence >= ${PID_LLM_DEFAULTS.confidenceThreshold} and historicalAuthoritySignals.length >= 1 and post_sale_poa_observed === false`,
      reviewer: `${PID_LLM_DEFAULTS.tier1ReviewerPrefix}:claude-opus-4-7`,
    },
  },
  ocr_facts: {
    disambiguate_extraction_error: {
      tier: "tier1_llm",
      decision: "extraction_error",
      guard: `LLM classification in {noise, header_artifact, duplicate} with confidence >= ${PID_LLM_DEFAULTS.confidenceThreshold}`,
      reviewer: `${PID_LLM_DEFAULTS.tier1ReviewerPrefix}:claude-opus-4-7`,
    },
    disambiguate_lead_only: {
      tier: "tier1_llm",
      decision: "lead_only",
      guard: `LLM classification = "real_fact" with confidence >= ${PID_LLM_DEFAULTS.confidenceThreshold}`,
      reviewer: `${PID_LLM_DEFAULTS.tier1ReviewerPrefix}:claude-opus-4-7`,
    },
  },
};

const TIER0_ROWS = [];
for (const [targetType, decisions] of Object.entries(POLICY)) {
  for (const [key, entry] of Object.entries(decisions)) {
    if (entry.tier === "tier0_rule") {
      TIER0_ROWS.push({ target_type: targetType, policy_key: key, decision: entry.decision });
    }
  }
}

export function getTier0Rows() {
  return TIER0_ROWS.slice();
}

export function tier0HasApproved() {
  return TIER0_ROWS.some((row) => row.decision === "approved");
}

export function explainPolicy(targetType, policyKey) {
  const entry = POLICY[targetType]?.[policyKey];
  if (!entry) return null;
  return { target_type: targetType, policy_key: policyKey, ...entry };
}

export function listPolicyKeys(targetType) {
  return Object.keys(POLICY[targetType] || {});
}

export const TIER1_AUTO_REVIEWER = `${PID_LLM_DEFAULTS.tier1ReviewerPrefix}:claude-opus-4-7`;
export const TIER0_AUTO_REVIEWER_PREFIX = PID_LLM_DEFAULTS.tier0ReviewerPrefix;
export const AUTO_APPROVE_CAP_PER_FAMILY = PID_LLM_DEFAULTS.autoApproveCapPerFamily;
export const CONFIDENCE_THRESHOLD = PID_LLM_DEFAULTS.confidenceThreshold;
