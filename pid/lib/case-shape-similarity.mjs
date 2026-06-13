// P-NEW-3: Case-shape similarity function.
//
// Given a current case shape (a structured tuple of fields we know about a
// plot/case under review), find the k most similar cases in the corpus. The
// similarity is structural: a case's "shape" is a tuple of normalized fields
// (forums, parties, family, claim type, property class). Two cases match
// when they share most of these dimensions. We DO NOT use semantic text
// matching — that would be a generalized "smart" system which the constitution
// (CLAUDE.md §2) explicitly prohibits.
//
// Returns matched cases with their resolution_summary when available. When
// P-NEW-2 fields are empty (no backfill yet), resolution_summary is null —
// the renderer collapses refs to [] and shows an honest "no precedent yet"
// rather than fabricated precedent. This is the load-bearing safety bound.
//
// Determinism: pure function on (corpusCases, currentShape, k) — no I/O, no
// randomness. Same inputs always produce same outputs.

/**
 * @typedef {Object} CaseShape
 * @property {string} [pattern_family] - court_dispute | drt_recovery | poa_chain | etc.
 * @property {string} [court_or_forum] - DRT-2, High Court, Civil Court, etc.
 * @property {string} [case_type] - OA, SA, EP, etc.
 * @property {string} [district] - geographic district
 * @property {string} [case_outcome] - if known
 */

/**
 * @typedef {Object} SimilarityMatch
 * @property {string} case_id
 * @property {string} case_number
 * @property {number} score - 0..1, higher is more similar
 * @property {string} pattern_family
 * @property {string|null} resolution_summary
 * @property {string|null} case_outcome
 * @property {string|null} deciding_factor
 * @property {string|null} buyer_action_that_succeeded
 * @property {string|null} remedy_type
 * @property {string[]} matched_dimensions
 */

/**
 * Normalize a case record or shape into a comparable tuple.
 * @param {CaseShape|Object} row
 * @returns {Object}
 */
export function shapeOf(row) {
  if (!row || typeof row !== "object") return {};
  return {
    pattern_family: String(row.pattern_family || row.case_shape?.pattern_family || "").trim().toLowerCase() || null,
    court_or_forum: String(row.court_or_forum || row.case_shape?.court_or_forum || "").trim().toLowerCase() || null,
    case_type: String(row.case_type || row.case_shape?.case_type || "").trim().toLowerCase() || null,
    district: String(row.district || row.case_shape?.district || "").trim().toLowerCase() || null,
    case_outcome: String(row.case_outcome || row.case_shape?.case_outcome || "").trim().toLowerCase() || null,
  };
}

const SHAPE_DIMENSIONS = ["pattern_family", "court_or_forum", "case_type", "district", "case_outcome"];

function dimensionsPresent(shape) {
  return SHAPE_DIMENSIONS.filter((dim) => shape[dim] != null && shape[dim] !== "");
}

/**
 * Score two shapes by Jaccard-style overlap on the dimensions that are
 * populated on the query. A dimension is "matched" when both shapes have a
 * value and those values are equal. Score is matched / populated.
 *
 * @param {Object} query - normalized shape tuple of the current case
 * @param {Object} candidate - normalized shape tuple of a corpus case
 * @returns {{score: number, matched_dimensions: string[]}}
 */
export function scoreShape(query, candidate) {
  const qDims = dimensionsPresent(query);
  if (qDims.length === 0) return { score: 0, matched_dimensions: [] };
  const matched = qDims.filter((dim) => {
    const qVal = query[dim];
    const cVal = candidate[dim];
    if (qVal == null || cVal == null) return false;
    return qVal === cVal;
  });
  return {
    score: matched.length / qDims.length,
    matched_dimensions: matched,
  };
}

/**
 * Find the k most similar cases to the current case shape. Returns matches
 * sorted by score desc, with non-null resolution_summary where P-NEW-2
 * backfill has populated it. Cases with score 0 are excluded.
 *
 * @param {Array<Object>} corpusCases - all cases from store.readCases()
 * @param {CaseShape} currentShape - shape of the case under review
 * @param {Object} [opts]
 * @param {number} [opts.k=10] - max number of matches to return
 * @param {number} [opts.minScore=0.4] - minimum score to include a match
 * @returns {SimilarityMatch[]}
 */
export function findSimilarCases(corpusCases, currentShape, opts = {}) {
  const k = Number.isFinite(opts.k) ? Math.max(1, Math.floor(opts.k)) : 10;
  const minScore = Number.isFinite(opts.minScore) ? Math.max(0, Math.min(1, opts.minScore)) : 0.4;

  if (!Array.isArray(corpusCases) || corpusCases.length === 0) return [];
  const query = shapeOf(currentShape);
  const qDims = dimensionsPresent(query);
  if (qDims.length === 0) return [];

  const scored = [];
  for (const candidate of corpusCases) {
    if (!candidate || typeof candidate !== "object") continue;
    if (candidate.id && currentShape.id && candidate.id === currentShape.id) continue;
    const cShape = shapeOf(candidate);
    const { score, matched_dimensions } = scoreShape(query, cShape);
    if (score < minScore) continue;
    scored.push({
      case_id: candidate.id || null,
      case_number: candidate.case_number || candidate.cnr || "—",
      score,
      pattern_family: candidate.pattern_family || cShape.pattern_family || null,
      resolution_summary: candidate.resolution_summary || null,
      case_outcome: candidate.case_outcome || null,
      deciding_factor: candidate.deciding_factor || null,
      buyer_action_that_succeeded: candidate.buyer_action_that_succeeded || null,
      remedy_type: candidate.remedy_type || null,
      matched_dimensions,
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.case_number && b.case_number) return a.case_number.localeCompare(b.case_number);
    return 0;
  });

  return scored.slice(0, k);
}

/**
 * Synthesize a SynthesisInsight[] from matched cases. Used by the renderer
 * to feed buildSynthesisInsights() with PID-backed cards. Returns [] when
 * no matches have resolution_summary populated (P-NEW-2 backfill not done
 * yet) — the renderer then shows only founder-curated content.
 *
 * @param {SimilarityMatch[]} matches
 * @param {string} patternCluster - name of the cluster (e.g. "Co-ownership consent gap")
 * @returns {Array}
 */
export function clusterFromMatches(matches, patternCluster) {
  if (!Array.isArray(matches) || matches.length === 0) return [];
  const withResolution = matches.filter((m) => m.resolution_summary);
  if (withResolution.length === 0) return [];

  const totalSimilar = matches.length;
  const decidingFactors = unique(withResolution.map((m) => m.deciding_factor).filter(Boolean));
  const buyerActions = unique(withResolution.map((m) => m.buyer_action_that_succeeded).filter(Boolean));
  const remedyTypes = unique(withResolution.map((m) => m.remedy_type).filter(Boolean));

  return [{
    patternCluster,
    clusterSummary: `${totalSimilar} similar case(s) found in the corpus. ${withResolution.length} of those had a recorded resolution.`,
    similarCaseCount: withResolution.length,
    totalSimilarCases: totalSimilar,
    decidingFactor: decidingFactors[0] || "Not recorded",
    recommendedAction: buyerActions[0] || remedyTypes[0] || "Refer to a property lawyer with the case details",
    sourceCaseRefs: withResolution.slice(0, 5).map((m) => ({
      caseId: m.case_id,
      caseNo: m.case_number,
      outcome: m.case_outcome || undefined,
      buyerAction: m.buyer_action_that_succeeded || undefined,
    })),
  }];
}

function unique(values) {
  return [...new Set(values)];
}
