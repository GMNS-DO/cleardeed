/**
 * P3 V3: cross-document reference join.
 *
 * Plan §4.5: when a Bhulekh mutation entry's docNo matches an IGR EC
 * entry's docNo (after normalise), surface a "see also" badge in
 * the lineage event pointing to the EC section in the report HTML.
 *
 * V3 ships in-report matching only — joins within a single report
 * (Bhulekh back page <-> IGR EC). Cross-report matching (across
 * different reports' ECs) is V4 and requires a `deed_index` table
 * or Supabase full-text search.
 *
 * Normalisation rules:
 *   - Lowercase
 *   - Strip whitespace and slashes
 *   - Drop the year prefix (e.g. "2026/KH/12345" -> "kh/12345")
 *     because the same deed may be cited in two different year
 *     formats (mutation 2020 vs EC 2020/21). Year drop is
 *     conservative — a year-mismatch is more likely a re-cite
 *     than a different deed.
 *   - Drop leading zeros in the trailing numeric portion
 *
 * The output is a Map<eventId, crossRef>. Callers attach the badge
 * to the lineage event.
 */

import type { LineageEvent, A13Result } from "./schema";

/** A normalised deed number key. */
function normaliseDocNo(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let s = raw.toLowerCase();
  // Strip whitespace, slashes, hyphens, periods, commas
  s = s.replace(/[\s\/\-.,]+/g, "");
  // Drop a leading 4-digit year (e.g. "2026kh12345" -> "kh12345")
  s = s.replace(/^\d{4}/, "");
  // Drop leading zeros in trailing numeric run
  s = s.replace(/0+(\d)/g, "$1");
  // Trim again
  s = s.trim();
  return s.length > 0 ? s : null;
}

export type IgrEcEntry = {
  docNo?: string;
  regDate?: string;
  party1?: string;
  party2?: string;
  propertyDesc?: string;
  consideration?: string;
  marketValue?: string;
};

export type CrossRefBadge = {
  label: string;
  href: string;
  sourceName: string;
  matchedDocNo?: string;
};

export type JoinedEvent = {
  eventId: string;
  crossRef: CrossRefBadge;
};

/**
 * Build a Map<eventId, crossRef> for events whose docNo matches an
 * EC entry. The Map is keyed by LineageEvent.id.
 *
 * @param events The lineage events emitted by reasonA13 (they
 *   already carry docNo from the Bhulekh back page).
 * @param ecEntries The IGR EC entries for this report.
 * @param options.reportId Used to build stable hrefs. The href
 *   points to a section anchor within the same report; the report
 *   template is expected to render each EC entry with a stable
 *   id (e.g. `id="ec-entry-{n}"`).
 * @param options.ecAnchorPrefix Anchor prefix used in the report
 *   template. Default "igr-ec-entry-".
 */
export function joinEventsToEc(
  events: LineageEvent[],
  ecEntries: IgrEcEntry[],
  options: {
    reportId: string;
    ecAnchorPrefix?: string;
  },
): Map<string, CrossRefBadge> {
  const result = new Map<string, CrossRefBadge>();
  if (events.length === 0 || ecEntries.length === 0) return result;

  // Build a normalised-key -> index lookup over EC entries.
  const ecIndex = new Map<string, number[]>();
  for (let i = 0; i < ecEntries.length; i++) {
    const key = normaliseDocNo(ecEntries[i]?.docNo);
    if (!key) continue;
    if (!ecIndex.has(key)) ecIndex.set(key, []);
    ecIndex.get(key)!.push(i);
  }

  const anchorPrefix = options.ecAnchorPrefix ?? "igr-ec-entry-";

  for (const ev of events) {
    const key = normaliseDocNo(ev.docNo);
    if (!key) continue;
    const matchIdx = ecIndex.get(key)?.[0];
    if (matchIdx === undefined) continue;
    const matched = ecEntries[matchIdx]!;
    result.set(ev.id, {
      label: "Also in IGR EC",
      href: `#${anchorPrefix}${matchIdx}`,
      sourceName: "igr-ec",
      matchedDocNo: matched.docNo,
    });
  }

  return result;
}

/**
 * Attach crossRef badges to a list of events. Returns a new array
 * of events (original events are not mutated). Events without a
 * badge pass through unchanged.
 */
export function attachCrossRefs(
  events: LineageEvent[],
  badges: Map<string, CrossRefBadge>,
): LineageEvent[] {
  if (badges.size === 0) return events;
  return events.map((ev) => {
    const badge = badges.get(ev.id);
    if (!badge) return ev;
    return { ...ev, crossRef: badge };
  });
}

/** Exposed for tests. */
export const _internal = { normaliseDocNo };
