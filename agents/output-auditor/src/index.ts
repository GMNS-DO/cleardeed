/**
 * A11 OutputAuditor — prohibited language scanner for ClearDeed
 *
 * Runs after A10 ConsumerReportWriter generates HTML.
 * Scans for prohibited language that would imply legal liability:
 *   - Score/grade verdicts
 *   - Purchase recommendations
 *   - Title certification language
 *   - Legal conclusions
 *
 * This is the liability gate — no report publishes without passing A11.
 */
import { z } from "zod";

// ─── Input / Output schemas ─────────────────────────────────────────────────────

export const ViolationSchema = z.object({
  type: z.enum([
    "prohibited_word",
    "prohibited_pattern",
    "missing_disclaimer",
    "missing_section",
    "source_state_violation",
    "score_detected",
  ]),
  severity: z.enum(["critical", "high", "medium"]),
  match: z.string(),
  context: z.string().nullable(),
  recommendation: z.string(),
});

export const AuditResultSchema = z.object({
  passed: z.boolean(),
  violations: z.array(ViolationSchema),
  html: z.string(),
  scanDurationMs: z.number(),
  reportId: z.string(),
  timestamp: z.string(),
});

export type AuditResult = z.infer<typeof AuditResultSchema>;
export type Violation = z.infer<typeof ViolationSchema>;

// ─── Prohibited patterns ────────────────────────────────────────────────────────

/** Exact prohibited words/phrases — zero tolerance */
const PROHIBITED_EXACT: [string, string][] = [
  // Score/grade language
  ["score:", "Score language (e.g., 'Score: 85/100')"],
  ["score is", "Score language"],
  ["trust score", "Trust/safety score language"],
  ["safety score", "Trust/safety score language"],
  ["verification score", "Verification score language"],
  ["reliability score", "Reliability score language"],
  ["grade:", "Grade language (e.g., 'Grade: A')"],
  ["grade:", "Grade language"],
  ["grade a", "Grade language"],
  ["grade b", "Grade language"],
  ["grade c", "Grade language"],
  ["overall grade", "Overall grade language"],
  ["rating:", "Rating language"],

  // Purchase recommendation
  ["safe to buy", "Purchase recommendation"],
  ["safe to purchase", "Purchase recommendation"],
  ["safe to invest", "Purchase recommendation"],
  ["recommended purchase", "Purchase recommendation"],
  ["recommended to buy", "Purchase recommendation"],
  ["good investment", "Investment recommendation"],
  ["solid investment", "Investment recommendation"],
  ["low risk investment", "Risk/return recommendation"],
  ["good deal", "Purchase recommendation"],

  // Title certification
  ["certified ownership", "Title certification language"],
  ["verified ownership", "Title certification language"],
  ["ownership verified", "Title certification language"],
  ["title is clear", "Title certification language"],
  ["clear title", "Title certification language"],
  ["clean title", "Title certification language"],
  ["guaranteed", "Guarantee language"],
  ["warrantied", "Warranty language"],
  ["title guaranteed", "Guarantee language"],
  ["ownership guaranteed", "Guarantee language"],

  // Legal conclusions
  ["legally verified", "Legal conclusion language"],
  ["legally clear", "Legal conclusion language"],
  ["legally verified", "Legal conclusion"],
  ["court verified", "Legal conclusion"],
  ["legally binding", "Legal conclusion"],
  ["no risk", "Risk conclusion language"],
  ["risk-free", "Risk conclusion language"],
  ["zero risk", "Risk conclusion language"],
  ["fully verified", "Verification conclusion"],
  ["100% verified", "Verification conclusion"],
  ["completely verified", "Verification conclusion"],
  ["fully confirmed", "Confirmation language"],

  // Absolute certainty
  ["no encumbrances", "Absolute encumbrance statement"],
  ["no disputes", "Absolute dispute statement"],
  ["no charges", "Absolute charge statement"],
  ["no liens", "Absolute lien statement"],
  ["no loans", "Absolute loan statement"],
  ["free and clear", "Absolute title statement"],
];

/** Regex patterns that indicate prohibited language */
const PROHIBITED_PATTERNS: [RegExp, string][] = [
  // Numeric scores
  [/\b\d{1,3}\s*\/\s*100\b/, "Numeric score in X/100 format"],
  [/\b\d+\s*out\s*of\s*100\b/i, "Numeric score (X out of 100)"],
  [/\btrust\s*score\s*[:\-]?\s*\d+\b/i, "Trust score with number"],
  [/\bsafety\s*score\s*[:\-]?\s*\d+\b/i, "Safety score with number"],

  // Grade patterns
  [/\bgrade\s*[:\-]?\s*[a-df](?:\b|[^a-z])/i, "Letter grade (A/B/C/D)"],
  [/\b[a-df]\s*grade\b/i, "Letter grade (A/B/C/D)"],
  [/\brating\s*[:\-]?\s*\d+\b/i, "Numeric rating"],
  [/\bstar\s*rating\b/i, "Star rating language"],

  // Recommendation patterns
  [/\brecommend(?:ed)?\s+(?:to\s+)?(?:buy|purchase|invest)/i, "Purchase recommendation"],
  [/\b(?:highly\s+)?recommend(?:ed)?\s+(?:this\s+)?(?:property|plot|land)/i, "Property recommendation"],
  [/\bgood\s+(?:investment|buy|deal)\b/i, "Investment/buy recommendation"],
  [/\b(?:low\s+risk|high\s+return)\b/i, "Risk/return language"],

  // Certification patterns
  [/\bcertified\s+(?:owner|ownership|title)\b/i, "Certification language"],
  [/\bverified\s+(?:owner|ownership)\b/i, "Verification certification"],
  [/\bconfirmed\s+(?:owner|ownership)\b/i, "Confirmation certification"],
  [/\bcleared\s+(?:for\s+)?(?:sale|purchase)\b/i, "Clearance language"],

  // Absolute certainty
  [/\bno\s+(?:court\s+)?(?:case|dispute|encumbrance|charge|lien|loan)\b.*\b(found|present|on)\b/i, "Absolute negative statement"],
  [/\b100%\s+(?:clear|verified|confirmed|safe)\b/i, "100% certainty language"],
  [/\bfree\s+(?:and\s+)?clear\b/i, "Free and clear language"],
  [/\bguarantee[sd]?\b/i, "Guarantee language"],
  [/\bwarrant[sy]\b/i, "Warranty language"],

  // Trust signal language
  [/\bhighly\s+trust(?:ed|worthy)?\b/i, "Trust signal"],
  [/\breliable\s+(?:source|record|report)\b/i, "Reliability signal"],
  [/\bauthentic\s+(?:record|document)\b/i, "Authenticity signal"],
];

// ─── Missing disclaimer check ───────────────────────────────────────────────────

const DISCLAIMER_INDICATORS = [
  "disclaimer",
  "not a legal opinion",
  "consult a lawyer",
  "consult a property lawyer",
  "public records",
  "information aggregator",
];

// ─── Core scanner ────────────────────────────────────────────────────────────────

export interface AuditOptions {
  /** Fail hard on critical violations (default: true) */
  failOnCritical?: boolean;
  /** Report ID for logging */
  reportId?: string;
  /** Run report-structure and source-state checks. Snippet tests can leave this off. */
  requireStructuralChecks?: boolean;
}

/**
 * Audit A10 HTML output for prohibited language.
 * Returns violations and optionally the quarantined HTML.
 */
export function auditReport(
  html: string,
  options: AuditOptions = {}
): AuditResult {
  const start = performance.now();
  const {
    failOnCritical = true,
    reportId = "unknown",
    requireStructuralChecks = false,
  } = options;

  const violations: Violation[] = [];
  const lowerHtml = html.toLowerCase();

  // ── Check exact prohibited phrases ──────────────────────────────────────
  for (const [phrase, recommendation] of PROHIBITED_EXACT) {
    const lowerPhrase = phrase.toLowerCase();
    const index = lowerHtml.indexOf(lowerPhrase);
    if (index !== -1) {
      const startCtx = Math.max(0, index - 40);
      const endCtx = Math.min(html.length, index + phrase.length + 40);
      const context = html.slice(startCtx, endCtx);
      if (isAllowedNegatedContext(phrase, context)) continue;
      violations.push({
        type: "prohibited_word",
        severity: "critical",
        match: html.slice(index, index + phrase.length),
        context,
        recommendation,
      });
    }
  }

  // ── Check regex patterns ────────────────────────────────────────────────
  for (const [pattern, recommendation] of PROHIBITED_PATTERNS) {
    const match = pattern.exec(html);
    if (match) {
      const startCtx = Math.max(0, match.index - 30);
      const endCtx = Math.min(html.length, match.index + match[0].length + 30);
      const context = html.slice(startCtx, endCtx);
      if (isAllowedNegatedContext(match[0], context)) continue;
      violations.push({
        type: "prohibited_pattern",
        severity: "high",
        match: match[0],
        context,
        recommendation,
      });
    }
  }

  // ── Check disclaimer presence ──────────────────────────────────────────
  const hasDisclaimer = DISCLAIMER_INDICATORS.some(
    (ind) => lowerHtml.includes(ind.toLowerCase())
  );
  if (!hasDisclaimer) {
    violations.push({
      type: "missing_disclaimer",
      severity: "critical",
      match: "(no disclaimer found)",
      context: null,
      recommendation:
        "Every ClearDeed report must include a disclaimer stating: ClearDeed surfaces public records and does not certify title, guarantee absence of fraud, or recommend transactions. A consumer must be told to consult a lawyer.",
    });
  }

  if (requireStructuralChecks) {
    violations.push(...auditStructuralRequirements(html));
  }

  // ── Determine pass/fail ────────────────────────────────────────────────
  const criticalViolations = violations.filter((v) => v.severity === "critical");
  const passed = failOnCritical
    ? criticalViolations.length === 0
    : violations.length === 0;

  const scanDurationMs = Math.round(performance.now() - start);

  // ── Quarantine if failed ────────────────────────────────────────────────
  let finalHtml = html;
  if (!passed) {
    finalHtml = prependViolationBanner(html, violations);
  }

  return AuditResultSchema.parse({
    passed,
    violations,
    html: finalHtml,
    scanDurationMs,
    reportId,
    timestamp: new Date().toISOString(),
  });
}

const REQUIRED_SECTION_IDS = [
  "section-summary",
  "section-source-audit",
  "section-plot",
  "section-owner",
  "section-land",
  "section-encumbrance",
  "section-regulatory",
  "section-action",
];

function auditStructuralRequirements(html: string): Violation[] {
  const violations: Violation[] = [];
  const lowerHtml = html.toLowerCase();
  const text = htmlToText(html).toLowerCase();

  for (const id of REQUIRED_SECTION_IDS) {
    if (!lowerHtml.includes(`id="${id}"`) && !lowerHtml.includes(`id='${id}'`)) {
      violations.push({
        type: "missing_section",
        severity: "critical",
        match: id,
        context: null,
        recommendation: `Consumer report is missing required section ${id}.`,
      });
    }
  }

  const ecourtsStatus = sourceStatusFromAudit(html, "ecourts");
  const rccmsStatus = sourceStatusFromAudit(html, "rccms");
  const courtSearchIncomplete = ecourtsStatus !== "success" || rccmsStatus !== "success";
  const noCaseRecordsReturnedWithoutCaveat =
    /no case records were returned/.test(text) &&
    !/not a full court-clearance finding/.test(text);
  const cleanCourtNegativeCopy =
    /no active civil or criminal court cases were found/.test(text) ||
    /no civil or criminal cases were found/.test(text) ||
    /0 active cases found/.test(text) ||
    /\bzero\s+(?:civil\/criminal\s+)?cases\s+found/.test(text) ||
    /\bzero\s+case\s+records\b/.test(text) ||
    noCaseRecordsReturnedWithoutCaveat;
  if (courtSearchIncomplete && cleanCourtNegativeCopy) {
    violations.push({
      type: "source_state_violation",
      severity: "critical",
      match: "Clean court negative-result copy",
      context:
        excerptAround(text, "no active civil or criminal court cases were found") ??
        excerptAround(text, "no civil or criminal cases were found") ??
        excerptAround(text, "0 active cases found") ??
        excerptAround(text, "zero cases found") ??
        excerptAround(text, "zero case records") ??
        excerptAround(text, "no case records were returned"),
      recommendation:
        "Court negative-result copy is only allowed when both eCourts and RCCMS completed with success.",
    });
  }

  const regulatoryIncomplete = /overlay screening:\s*not fully verified in this run/.test(text);
  if (
    regulatoryIncomplete &&
    /no immediate regulatory flags were found/.test(text)
  ) {
    violations.push({
      type: "source_state_violation",
      severity: "critical",
      match: "No immediate regulatory flags were found",
      context: excerptAround(text, "no immediate regulatory flags were found"),
      recommendation:
        "Regulatory clean-copy is only allowed when overlay screening is marked complete.",
    });
  }

  const singleTokenOwnerInput =
    /you entered a single-word name/.test(text) ||
    /only a surname or single-word owner name/.test(text) ||
    /only a surname or single word/.test(text);
  const greenOwnerMatchCopy =
    /full-name match/.test(text) ||
    /matches the seller-provided full name/.test(text) ||
    /bhulekh ror owner name matches/.test(text);
  if (singleTokenOwnerInput && greenOwnerMatchCopy) {
    violations.push({
      type: "source_state_violation",
      severity: "critical",
      match: "Full-name owner match with single-token input",
      context: excerptAround(text, "single-word"),
      recommendation:
        "Single-token or surname-only owner input cannot render green owner-match copy.",
    });
  }

  const surnameOnlyMethod =
    /method:\s*(odia_surname_map|surname_dice|surname_cluster)/.test(text) ||
    /surname appears in the odia ror name/.test(text) ||
    /surname similarity matched/.test(text);
  if (surnameOnlyMethod && greenOwnerMatchCopy) {
    violations.push({
      type: "source_state_violation",
      severity: "critical",
      match: "Full-name owner match from surname-only method",
      context: excerptAround(text, "surname"),
      recommendation:
        "Surname-only owner-match methods can support partial/ambiguous copy only, never full-name match copy.",
    });
  }

  if (!/what to ask next/.test(text) || !/encumbrance certificate/.test(text)) {
    violations.push({
      type: "missing_section",
      severity: "critical",
      match: "buyer action checklist",
      context: null,
      recommendation:
        "Consumer report must include buyer action copy, including Encumbrance Certificate follow-up.",
    });
  }

  return violations;
}

function sourceStatusFromAudit(html: string, source: string): string | undefined {
  const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<td>\\s*${escapedSource}\\s*<\\/td>\\s*<td>\\s*([^<]+?)\\s*<\\/td>`,
    "i"
  );
  const match = html.match(pattern);
  return match?.[1]?.trim().toLowerCase();
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function excerptAround(text: string, phrase: string): string {
  const index = text.indexOf(phrase);
  if (index === -1) return text.slice(0, 160);
  return text.slice(Math.max(0, index - 60), Math.min(text.length, index + phrase.length + 60));
}

function isAllowedNegatedContext(match: string, context: string): boolean {
  const normalizedMatch = match.toLowerCase();
  const normalizedContext = context.toLowerCase().replace(/\s+/g, " ");

  if (
    normalizedMatch.includes("guarantee") &&
    /\b(?:not|no|does not|doesn't|cannot|can't|without)\s+(?:a\s+)?guarantee/.test(normalizedContext)
  ) {
    return true;
  }

  if (
    normalizedMatch.includes("guaranteed") &&
    /\b(?:not|no|does not|doesn't|cannot|can't)\s+(?:be\s+)?guaranteed\b/.test(normalizedContext)
  ) {
    return true;
  }

  if (
    normalizedMatch.includes("fully verified") &&
    /\b(?:not|not yet|cannot be|can't be|isn't)\s+fully verified\b/.test(normalizedContext)
  ) {
    return true;
  }

  if (
    /verified\s+ownership|ownership\s+verified/.test(normalizedMatch) &&
    /\b(?:not|not yet|cannot be|can't be|isn't|are not)\s+verified\s+ownership\b/.test(normalizedContext)
  ) {
    return true;
  }

  return false;
}

/**
 * Inject a violation warning banner into HTML for human review.
 */
function prependViolationBanner(html: string, violations: Violation[]): string {
  const critical = violations.filter((v) => v.severity === "critical");
  const high = violations.filter((v) => v.severity === "high");

  const lines = violations.map(
    (v) => `• <code>${escapeHtml(v.match)}</code>: ${escapeHtml(v.context ?? v.recommendation)}`
  ).join("\n");

  const banner = `
<div style="
  background: #fef2f2;
  border: 2px solid #b91c1c;
  border-radius: 8px;
  padding: 16px 20px;
  margin: 20px;
  font-family: system-ui, sans-serif;
  font-size: 14px;
">
  <div style="font-weight: 700; color: #b91c1c; font-size: 16px; margin-bottom: 8px;">
    &#9888; Report held for review — A11 OutputAuditor
  </div>
  <div style="color: #7f1d1d; margin-bottom: 12px;">
    This report was not published. ${critical.length} critical and ${high.length} high severity violation(s) detected:
  </div>
  <div style="background: #fee2e2; border-radius: 4px; padding: 12px; font-size: 13px; line-height: 1.8;">
${lines}
  </div>
  <div style="color: #7f1d1d; margin-top: 12px; font-size: 12px;">
    The pipeline team has been notified. Do not share this report with the consumer.
  </div>
</div>`;

  return html.replace(/<body[^>]*>/, `$&${banner}`);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Integration helper ────────────────────────────────────────────────────────

/**
 * Run A11 audit as part of the pipeline.
 * Throws if critical violations found (report should not publish).
 */
export function auditOrThrow(html: string, reportId: string): AuditResult {
  const result = auditReport(html, {
    reportId,
    failOnCritical: true,
    requireStructuralChecks: true,
  });
  if (!result.passed) {
    const summary = result.violations
      .map((v) => `${v.severity}: ${v.match}`)
      .join("; ");
    throw new Error(
      `A11 OutputAuditor blocked report ${reportId}: ${result.violations.length} violation(s) — ${summary}`
    );
  }
  return result;
}
