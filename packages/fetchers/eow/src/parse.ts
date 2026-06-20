/**
 * Press-release HTML parser for the Khordha EOW (Economic Offences Wing)
 * blacklist.
 *
 * The parser extracts three classes of facts from a single press release:
 *   1. Case reference (FIR number, OPID case number, court case number).
 *   2. Attached properties (plot number, khata number, village, tahasil).
 *   3. Arrested persons (full name, role, optional arrest date).
 *
 * Real-world input shape: the EOW Odisha site is offline / unreachable from
 * the build environment, so this parser targets the structure observed in
 * archived press releases and in the documented case law (e.g. the Surya
 * Nirman order from 2023, which describes attached properties in prose with
 * plot numbers, khata numbers, mouza/village, and Tahasil).
 *
 * The parser is regex-first on purpose: the live EOW portal is a static,
 * server-rendered HTML page (no JSON API), and any future SPA migration is
 * out of scope until a real probe succeeds.
 */

import type {
  EOWArrestedPerson,
  EOWAttachedProperty,
} from "./blacklist";

const PARSER_VERSION = "eow-press-release-v1";

/**
 * Heuristics for finding a case reference inside a press release.
 *
 * EOW press releases refer to cases using one of:
 *   - "FIR No. 12/2019"          (regular police FIR)
 *   - "EOW P.S. Case No. 07/2023" (EOW police-station case)
 *   - "OPID Case No. ..."        (Odisha Police IOD reference)
 *   - "OPID/CID-CB/..."          (sometimes formatted as a slash-separated string)
 *
 * The regex tolerates the variable punctuation and stores whatever it found
 * in the `caseRef` field. The matcher only uses the caseRef as a label; the
 * load-bearing cross-reference is plot number and owner name.
 */
const CASE_RE_PATTERNS: RegExp[] = [
  /\bEOW\s+P\.?S\.?\s*Case\s*No\.?\s*[:\-]?\s*([A-Z0-9/.\-]+)/i,
  /\bFIR\s*No\.?\s*[:\-]?\s*([A-Z0-9/.\-]+)/i,
  /\bOPID\s*Case\s*No\.?\s*[:\-]?\s*([A-Z0-9/.\-]+)/i,
  /\bOPID\s*\/\s*CID[\-/][A-Z0-9/.\-]+/i,
  /\bCase\s*No\.?\s*[:\-]?\s*([0-9]{1,4}\s*(?:of\s*)?[0-9]{4})/i,
];

/**
 * Patterns for "Plot No. X" / "Khata No. Y" / "Mouza / Village: Z".
 *
 * The press release may use "Plot No." or "Plot Number"; "Khata" or
 * "Khatiyan"; "Village" or "Mouza". All of these are normalized by the
 * helpers in blacklist.ts.
 */
const PLOT_PATTERNS: RegExp[] = [
  /\bPlot\s*(?:No\.?|Number)?\s*[:\-]?\s*([0-9]{1,5}(?:\s*[\/\-]\s*[0-9A-Za-z]{1,5})?)/gi,
  /\bPlot\s*No\.?\s*([0-9]{1,5})\s*of\s*Khata\s*No\.?\s*([0-9]{1,5})/gi,
];
const KHATA_PATTERNS: RegExp[] = [
  /\bKhata\s*(?:No\.?|Number)?\s*[:\-]?\s*([0-9]{1,5})/gi,
  /\bKhatiyan\s*(?:No\.?|Number)?\s*[:\-]?\s*([0-9]{1,5})/gi,
];
const VILLAGE_PATTERNS: RegExp[] = [
  /\b(?:Village|Mouza|Moza|Mouje)\s*[:\-]?\s*([A-Z][A-Za-z\s]{2,40}?)(?=,|\.|;|\b(?:Tahsil|Tahasil|Tehsil|Plot|Khata|of)\b|$)/gm,
];
const TAHASIL_PATTERNS: RegExp[] = [
  /\b(?:Tahsil|Tahasil|Tehsil)\s*[:\-]?\s*([A-Z][A-Za-z\s]{2,40}?)(?=,|\.|;|\b(?:Dist|Plot|Khata)\b|$)/gm,
];

/**
 * Arrested-person patterns. Press releases typically say "arrested <Name>",
 * "apprehended <Name>", "<Name> Director of M/s X", or list names in a
 * bulleted section titled "Persons Arrested" / "Accused Arrested".
 */
const ARREST_PATTERNS: RegExp[] = [
  // "arrested Arun Kumar Sahu on..."
  /\barrested\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})/g,
  // "apprehended Arun Kumar Sahu..."
  /\bapprehended\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})/g,
  // "Arun Kumar Sahu, Director, M/s Surya Nirman Resources Pvt Ltd, aged 48
  // years" — name at the start of a person-line, then role/company text,
  // then "aged N". The name is the first 2-4 capitalized words; role
  // keywords (Director, Promoter, etc.) are the most common middle text.
  /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3}),\s*(?:[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,4}\s*,?\s*){0,3}(?:aged|age)\s+[0-9]+/g,
];

/**
 * Date patterns: ISO 8601 (preferred), dd/mm/yyyy, dd-MMM-yyyy, dd Month yyyy.
 * The first match wins. The parser is conservative — if the date cannot be
 * confidently extracted, the field is left undefined and the entry gets
 * `confidence: "probable"` instead of `"verified"`.
 */
const DATE_PATTERNS: RegExp[] = [
  /\b(\d{4}-\d{2}-\d{2})\b/,
  /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/,
  /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/i,
];

/**
 * Single parsed press release.
 *
 * - `caseRef` is the primary key the matcher uses to dedupe entries across
 *   press releases covering the same case.
 * - `properties` and `arrestedPersons` are the two collections the matcher
 *   queries.
 * - `confidence` is `verified` only when both the case ref and at least one
 *   structured fact (plot or person name) were extracted cleanly.
 */
export interface ParsedPressRelease {
  parserVersion: string;
  caseRef: string;
  attachmentDate?: string;
  publishedAt: string;
  sourceUrl: string;
  rawText: string;
  properties: EOWAttachedProperty[];
  arrestedPersons: EOWArrestedPerson[];
  confidence: "verified" | "probable" | "manual_required";
}

/**
 * Convert HTML to plain text. This is intentionally simple: it strips tags
 * and decodes the few HTML entities that show up in EOW press releases
 * (`&amp;`, `&nbsp;`, `&#39;`). We do not use a real HTML parser because
 * (a) the press release HTML is well-formed and shallow, and (b) keeping
 * the dependency surface small makes the fetcher easy to run inside
 * Vercel/Node 22 serverless functions.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?(p|div|br|li|tr|h\d|td|th|article|section)\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    // Strip common section-heading boilerplate that survives tag removal
    // (e.g. "Persons Arrested", "Properties Attached"). Without this the
    // arrested-persons extractor treats the heading as a candidate name.
    .replace(/\bPersons Arrested\b\s*/gi, "")
    .replace(/\bAccused Arrested\b\s*/gi, "")
    .replace(/\bProperties Attached\b\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract a case reference from a plain-text press release. Returns the
 * first match across the known patterns, or an empty string if none.
 */
export function extractCaseRef(text: string): string {
  for (const pat of CASE_RE_PATTERNS) {
    const m = pat.exec(text);
    if (m && m[1]) return m[1].trim();
  }
  return "";
}

/**
 * Extract the publication date from a press release. We try the <time>
 * element first, then meta tags, then the plain-text date patterns.
 *
 * The function returns an ISO date string when possible, or the raw string
 * the parser found. The caller decides whether to trust it.
 */
export function extractPublishedAt(html: string, text: string): string {
  const isoFromTag = /<time[^>]+datetime=["']([^"']+)["']/i.exec(html);
  if (isoFromTag && isoFromTag[1]) {
    const parsed = new Date(isoFromTag[1]);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const metaDate = /<meta[^>]+(?:name|property)=["'](?:article:published_time|date)["'][^>]+content=["']([^"']+)["']/i.exec(html);
  if (metaDate && metaDate[1]) {
    const parsed = new Date(metaDate[1]);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  for (const pat of DATE_PATTERNS) {
    const m = pat.exec(text);
    if (m && m[1]) {
      const parsed = new Date(m[1]);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
  }
  return new Date(0).toISOString();
}

/**
 * Extract an attachment date. Looks for the word "attachment" within ~30
 * chars of a date; if not found, falls back to the publication date.
 */
export function extractAttachmentDate(text: string, fallback: string): string | undefined {
  const ctxRe = /attach(?:ed|ment)[^.]{0,80}?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i;
  const m = ctxRe.exec(text);
  if (m && m[1]) {
    const parsed = new Date(m[1]);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return fallback && fallback !== new Date(0).toISOString() ? fallback : undefined;
}

/**
 * Collect all plot-number matches across the press release text.
 *
 * The function supports two shapes:
 *  - "Plot No. 415" → ["415"]
 *  - "Plot No. 415 of Khata No. 94" → [{ plot: "415", khata: "94" }]
 *
 * It deduplicates by plot number so a single press release mentioning the
 * same plot twice produces one entry.
 */
export function extractPlots(text: string): Array<{ plot: string; khata?: string }> {
  const seen = new Set<string>();
  const out: Array<{ plot: string; khata?: string }> = [];

  // Pattern A: "Plot No. X of Khata No. Y" — yields both plot and khata in one shot.
  for (const re of PLOT_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[1] && m[2]) {
        const plot = m[1].trim();
        const khata = m[2].trim();
        if (plot && !seen.has(plot)) {
          seen.add(plot);
          out.push({ plot, khata });
        }
      }
    }
  }

  // Pattern B: standalone "Plot No. X" — khata inferred from KHATA_PATTERNS later.
  for (const re of PLOT_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[1] && !m[2]) {
        const plot = m[1].trim();
        if (plot && !seen.has(plot)) {
          seen.add(plot);
          out.push({ plot });
        }
      }
    }
  }
  return out;
}

/**
 * Collect khata numbers from the press release. Returned in document order;
 * the caller is responsible for associating them with plots.
 */
export function extractKhatas(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const re of KHATA_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[1]) {
        const k = m[1].trim();
        if (k && !seen.has(k)) {
          seen.add(k);
          out.push(k);
        }
      }
    }
  }
  return out;
}

/**
 * Extract the first village and tahasil mentioned in the press release.
 * Multi-village cases are out of scope for the V1.1 blacklist; they will be
 * handled as a follow-up when real press releases arrive.
 */
export function extractLocation(text: string): { village?: string; tahasil?: string } {
  let village: string | undefined;
  let tahasil: string | undefined;
  for (const re of VILLAGE_PATTERNS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m && m[1]) {
      village = m[1].trim();
      break;
    }
  }
  for (const re of TAHASIL_PATTERNS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m && m[1]) {
      tahasil = m[1].trim();
      break;
    }
  }
  return { village, tahasil };
}

/**
 * Extract arrested-person names from the press release.
 *
 * Real EOW press releases use a mix of prose ("X was arrested on…") and
 * bulleted sections. The regex set is conservative: it only emits a name
 * when at least two title-cased words appear, which avoids false positives
 * from sentence-starting common nouns ("The Court...").
 */
export function extractArrestedPersons(text: string): Array<{ name: string; role?: string }> {
  const out: Array<{ name: string; role?: string }> = [];
  const seen = new Set<string>();
  // Split into sentences / list items, then look for name + age in each.
  // This is more robust than a single mega-regex because real EOW press
  // releases have a mix of prose and bulleted sections.
  const segments = text.split(/[\n\.;](?:\s+|$)/).map((s) => s.trim()).filter(Boolean);
  // EOW press releases often introduce the arrest list with prose like
  // "The following persons have been arrested in connection with the
  // above case: Arun Kumar Sahu, Director, … aged 48, … Pradeep Kumar
  // Mohanty, … aged 51, …". The first segment merges all three arrests
  // into one block. Split on commas and ": " as well so each candidate
  // name is its own chunk.
  const chunks: string[] = [];
  for (const segment of segments) {
    if (!/\b(?:aged|age)\s+\d+/i.test(segment)) continue;
    for (const part of segment.split(/[:,]\s+/)) {
      const trimmed = part.trim();
      if (trimmed) chunks.push(trimmed);
    }
  }
  for (const chunk of chunks) {
    // Find the first 2-4 capitalized words at the start of the chunk.
    // Allow embedded role/company text but require the *first* run of
    // capitalized words to be 2-4 tokens.
    const headMatch = /^\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})/.exec(chunk);
    if (!headMatch) continue;
    const name = headMatch[1].trim();
    if (seen.has(name.toLowerCase())) continue;
    if (/\b(PVT|LTD|LIMITED|RESOURCES|INDUSTRIES|CORPORATION|TRADERS|ENTERPRISES|INDIA|GROUP|EOW|CID|PS)\b/i.test(name)) continue;
    if (name.length > 60) continue;
    seen.add(name.toLowerCase());
    // Try to extract a role keyword (Director, Promoter, MD) from the
    // remainder of the chunk.
    const roleMatch = /\b(Director|Promoter|Managing Director|Chairman|Secretary|Partner)\b/i.exec(chunk);
    const role = roleMatch ? roleMatch[1] : undefined;
    out.push(role ? { name, role } : { name });
  }
  // Also try the regex patterns for prose-style press releases where the
  // age doesn't appear (older EOW releases used "Mr X was arrested").
  for (const re of ARREST_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const name = (m[1] ?? "").trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      if (name.split(/\s+/).length < 2) continue;
      if (/\b(PVT|LTD|LIMITED|RESOURCES|INDUSTRIES|CORPORATION|TRADERS|ENTERPRISES|INDIA|GROUP)\b/i.test(name)) continue;
      if (name.length > 60) continue;
      seen.add(name.toLowerCase());
      out.push({ name });
    }
  }
  return out;
}

/**
 * Main entry point: parse a press release HTML string into a structured
 * `ParsedPressRelease` with attached properties and arrested persons.
 *
 * The function is pure (no I/O). It is safe to call from inside the probe
 * script, the live fetcher, or unit tests.
 */
export function parsePressRelease(input: {
  html: string;
  sourceUrl: string;
  publishedAt?: string;
}): ParsedPressRelease {
  const text = htmlToText(input.html);
  const caseRef = extractCaseRef(text);
  const publishedAt = input.publishedAt ?? extractPublishedAt(input.html, text);
  const attachmentDate = extractAttachmentDate(text, publishedAt);
  const plots = extractPlots(text);
  const khatas = extractKhatas(text);
  const location = extractLocation(text);
  const arrests = extractArrestedPersons(text);

  // If we found plots but no standalone khata matches, the khata already
  // came in via the "Plot No. X of Khata No. Y" pattern. If we found
  // khatas but no plots, attach the first khata to a synthetic
  // "(unspecified)" plot so the entry is still matchable when the buyer
  // supplies a plot number — the matcher will then see khata matches and
  // village matches and produce a probable (not verified) hit.
  const properties: EOWAttachedProperty[] = plots.map((p, idx) => ({
    id: `${caseRef || "unknown"}-plot-${idx + 1}`,
    caseRef: caseRef || "unknown",
    plotNo: p.plot,
    khataNo: p.khata ?? (khatas.length === 1 ? khatas[0] : undefined),
    village: location.village,
    tahasil: location.tahasil,
    attachmentDate,
    confidence: caseRef && (p.plot || p.khata) ? "verified" : "probable",
    sourceUrl: input.sourceUrl,
    sourcePublishedAt: publishedAt,
  }));

  const arrestedPersons: EOWArrestedPerson[] = arrests.map((a, idx) => ({
    id: `${caseRef || "unknown"}-person-${idx + 1}`,
    caseRef: caseRef || "unknown",
    name: a.name,
    role: a.role,
    arrestDate: attachmentDate,
    confidence: caseRef && a.name ? "verified" : "probable",
    sourceUrl: input.sourceUrl,
    sourcePublishedAt: publishedAt,
  }));

  const confidence: ParsedPressRelease["confidence"] =
    caseRef && (properties.length > 0 || arrestedPersons.length > 0)
      ? "verified"
      : caseRef
        ? "probable"
        : "manual_required";

  return {
    parserVersion: PARSER_VERSION,
    caseRef,
    attachmentDate,
    publishedAt,
    sourceUrl: input.sourceUrl,
    rawText: text,
    properties,
    arrestedPersons,
    confidence,
  };
}

export { PARSER_VERSION as PARSE_PARSER_VERSION };
