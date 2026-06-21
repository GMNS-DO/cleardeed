// agents/consumer-report-writer/src/components/tested-patterns.ts
//
// T1 — Tested Fraud Patterns Panel.
// 5 patterns from CLAUDE.md Section 3 ("On fraud pattern detection").
// For every report, every pattern is shown with explicit pass / fail result,
// the rules that tested it, the source URL, and the trust percentage.
//
// Visibility rule: the panel is always rendered, even when all 5 pass.
// This is the trust moat — buyers see "we know the local scams and we
// tested each one against this plot."

import type { Insight } from "../schema";

// ── Pattern definitions ──────────────────────────────────────────────────

export interface FraudPattern {
  id: string;
  name: string;
  /** Plain-English rule (what we tested for). */
  check: string;
  /** Rule IDs in the registry whose fire/fail constitutes the pattern test. */
  ruleIds: string[];
  /** Source URL or portal to verify against. */
  source: { label: string; url: string };
  /**
   * Optional one-line explanation the panel shows when the pattern triggers.
   * The action item comes from the fired insight (via insight.actionItem).
   */
  triggerNote: string;
  /**
   * Optional detail shown when the pattern passes — what specifically we
   * checked and what we found. Caller provides this from the runtime
   * data (e.g. "No lease tenure indicator in RoR; raw kisam is private").
   */
  buildPassDetail?: (input: PatternEvalInput) => string;
}

export interface PatternEvalInput {
  insights: Insight[];
  revenueRecords: any | null;
  firedRuleIds: Set<string>;
}

export const FRAUD_PATTERNS: FraudPattern[] = [
  {
    id: "PAT-1",
    name: "Patia Industrial-Lease Scam",
    check:
      "IGR RLD prefix (lease deed) on a Sthitiban/Raiyati khata — lease-to-freehold land resumption under OGLS Act S.3B.",
    ruleIds: ["ROR-INS-180"],
    source: { label: "Bhulekh RoR + IGR SRO", url: "https://bhulekh.ori.nic.in/" },
    triggerNote:
      "Detected a lease tenure word in Bhulekh rights (RLD prefix or sthitiban/raiyati raw kisam). IGR cross-check required before purchase.",
    buildPassDetail: (input) => {
      const ok =
        !input.firedRuleIds.has("ROR-INS-180") &&
        Boolean(input.revenueRecords);
      return ok
        ? "No lease tenure indicator on the Bhulekh RoR. Raw kisam reads as private ownership."
        : "Bhulekh RoR was not retrieved — cannot test this pattern with confidence.";
    },
  },
  {
    id: "PAT-2",
    name: "Surya Nirman Multi-Investor Fraud",
    check:
      "EOW blacklist cross-reference (plot + khata) plus owner name against arrest list.",
    ruleIds: ["ROR-INS-210", "ROR-INS-211"],
    source: {
      label: "khordha_eow_blacklist.json",
      url: "https://bhulekh.ori.nic.in/",
    },
    triggerNote:
      "Plot or owner appears on the Khordha EOW blacklist or arrest list. STOP — do not proceed without a lawyer.",
    buildPassDetail: (_input) =>
      "Plot and owner name are not on the Khordha EOW blacklist (refreshed weekly).",
  },
  {
    id: "PAT-3",
    name: "Malipada Impersonation Scam",
    check:
      "Seller's address far from plot + no registered PoA at local SRO. Watch for cross-district seller addresses.",
    ruleIds: ["ROR-INS-024", "ROR-INS-025", "ROR-INS-075"],
    source: { label: "Bhulekh RoR + IGR SRO", url: "https://bhulekh.ori.nic.in/" },
    triggerNote:
      "Seller name does not match the Bhulekh RoR owner, OR seller's address is in a different district, OR no PoA is on record. Video KYC the seller and contact the RoR owner directly.",
    buildPassDetail: (_input) =>
      "Seller name matches the Bhulekh owner, or no sellername was supplied to compare against.",
  },
  {
    id: "PAT-4",
    name: "Industrial-Zone Plot Sold as Residential",
    check:
      "Plot GPS cross-referenced against BDA Master Plan zoning (industrial / industrial_2 zone).",
    ruleIds: ["ROR-INS-153"],
    source: {
      label: "BDA Master Plan 2030",
      url: "https://www.bhubaneswardevelopmentauthority.in/",
    },
    triggerNote:
      "Plot is in a BDA industrial zone but is being marketed (or transferred) as residential. STOP — verify permitted use.",
    buildPassDetail: (_input) =>
      "Plot is in a Residential zone per the BDA Master Plan 2030. No industrial-zone risk detected.",
  },
  {
    id: "PAT-5",
    name: "Subdivided Plot Without BDA Layout Approval",
    check:
      "Sub-plot indicator (e.g. 415/1, D/88) on the RoR + BDA layout approval status.",
    ruleIds: ["ROR-INS-040", "ROR-INS-046"],
    source: { label: "Bhulekh RoR + BDA layout register", url: "https://bhulekh.ori.nic.in/" },
    triggerNote:
      "Sub-plot indicator (415/1, D/88, etc.) is present on the RoR. Full property value is at risk if BDA challenges the sub-division. Verify BDA layout approval on file.",
    buildPassDetail: (_input) =>
      "No sub-plot indicator on the target plot row. BDA approval status not separately tested in this version.",
  },
];

// ── Evaluation ───────────────────────────────────────────────────────────

export interface PatternResult {
  pattern: FraudPattern;
  state: "passed" | "triggered" | "untested";
  /** Triggering insight's headline, if any. */
  firedInsight: Insight | null;
  /** Pass-detail line shown when state === "passed". */
  passDetail: string;
}

export function evaluatePatterns(input: PatternEvalInput): PatternResult[] {
  const insightsByRuleId = new Map<string, Insight>();
  for (const ins of input.insights) {
    if (!ins || !(ins as any).ruleId) continue;
    insightsByRuleId.set((ins as any).ruleId, ins);
  }

  return FRAUD_PATTERNS.map((pattern) => {
    let firedInsight: Insight | null = null;
    let triggered = false;
    for (const rid of pattern.ruleIds) {
      const ins = insightsByRuleId.get(rid);
      if (!ins) continue;
      const sev = (ins as any).severity;
      if (sev === "redFlag" || sev === "watchout") {
        firedInsight = ins;
        triggered = true;
        break;
      }
    }
    const state: PatternResult["state"] = firedInsight
      ? "triggered"
      : input.revenueRecords
      ? "passed"
      : "untested";
    const passDetail = pattern.buildPassDetail
      ? pattern.buildPassDetail(input)
      : "Tested against available data — no rule triggered.";
    return { pattern, state, firedInsight, passDetail };
  });
}

// ── Render ───────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

function stateIcon(state: PatternResult["state"]): string {
  if (state === "triggered") return "🛑";
  if (state === "passed") return "✅";
  return "⏳";
}

function stateLabel(state: PatternResult["state"]): string {
  if (state === "triggered") return "TRIGGERED";
  if (state === "passed") return "Not triggered";
  return "Untested";
}

export function buildTestedPatternsPanel(input: {
  results: PatternResult[];
  fetchedAt: string;
}): string {
  const triggered = input.results.filter((r) => r.state === "triggered");
  const passed = input.results.filter((r) => r.state === "passed");
  const untested = input.results.filter((r) => r.state === "untested");

  const summaryParts: string[] = [];
  if (triggered.length) summaryParts.push(`${triggered.length} triggered`);
  if (passed.length) summaryParts.push(`${passed.length} of ${input.results.length} patterns passed`);
  if (untested.length)
    summaryParts.push(`${untested.length} untested (no source data)`);
  const summary = summaryParts.length
    ? summaryParts.join(" · ")
    : "Tested against available data.";

  const rows = input.results
    .map((r, idx) => {
      const pat = r.pattern;
      const icon = stateIcon(r.state);
      const label = stateLabel(r.state);
      const rulesList = pat.ruleIds
        .map((rid) => `<code>${escapeHtml(rid)}</code>`)
        .join(", ");
      const detail =
        r.state === "triggered"
          ? r.pattern.triggerNote
          : r.state === "passed"
          ? r.passDetail
          : "No source data available to run this test. Manual verification required.";
      const actionHtml =
        r.state === "triggered" && r.firedInsight
          ? `<div class="tp-action">→ Action: ${escapeHtml(
              (r.firedInsight as any).actionItem || "Manual verification required."
            )}</div>`
          : "";
      return `
    <li class="tp-row" data-state="${escapeAttr(r.state)}">
      <div class="tp-icon">${icon}</div>
      <div class="tp-body">
        <div class="tp-head">
          <span class="tp-num">${idx + 1}.</span>
          <span class="tp-name">${escapeHtml(pat.name)}</span>
          <span class="tp-state">${escapeHtml(label)}</span>
        </div>
        <div class="tp-check"><b>Check:</b> ${escapeHtml(pat.check)}</div>
        <div class="tp-result">${escapeHtml(detail)}</div>
        <div class="tp-evidence">
          <span><b>Rules:</b> ${rulesList}</span>
          <span> · <b>Source:</b> <a href="${escapeAttr(
            pat.source.url
          )}" target="_blank" rel="noopener noreferrer">${escapeHtml(
        pat.source.label
      )}</a></span>
          <span> · Tested ${escapeHtml(input.fetchedAt)}</span>
        </div>
        ${actionHtml}
      </div>
    </li>`;
    })
    .join("");

  return `
<section class="tested-patterns" id="tested-patterns">
  <div class="tp-header">
    <div class="tp-eyebrow">TESTED FRAUD PATTERNS (Khordha 2024–2026)</div>
    <div class="tp-summary">${escapeHtml(summary)}</div>
  </div>
  <ol class="tp-list">${rows}
  </ol>
</section>`;
}
