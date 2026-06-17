/**
 * P3 V1 sort — chronological event ordering with deterministic tie-break.
 *
 * Plan §4.6: `sortEventsChronologically()` is a required function in V1.
 *
 * Input dates may be in any of these formats (Bhulekh mutation history
 * is notoriously inconsistent):
 *   - ISO 8601: "2020-01-15"
 *   - DD/MM/YYYY: "15/01/2020"
 *   - DD-MM-YYYY: "15-01-2020"
 *   - YYYY/MM/DD: "2020/01/15"
 *   - Bare year: "2020"
 *   - Unknown: "" / null / "—"
 *
 * Tie-break: if two events have the same date (or both unknown),
 * order by:
 *   1. mutationNumber / docNo (lexicographic)
 *   2. id (lexicographic, last-resort determinism)
 */

export type SortableEvent = {
  id: string;
  date?: string;
  docNo?: string;
  mutationNumber?: string;
};

/** Parse a date string into a sortable key (YYYYMMDD), or null if unknown. */
export function parseDateToSortKey(input: string | undefined | null): number | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  // ISO 8601 (YYYY-MM-DD)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return Number(iso[1]) * 10000 + Number(iso[2]) * 100 + Number(iso[3]);
  // YYYY/MM/DD
  const ymd = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (ymd) return Number(ymd[1]) * 10000 + Number(ymd[2]) * 100 + Number(ymd[3]);
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) return Number(dmy[3]) * 10000 + Number(dmy[2]) * 100 + Number(dmy[1]);
  // Bare year
  const year = s.match(/^(\d{4})$/);
  if (year) return Number(year[1]) * 10000;
  // MM/YY or MM-YY
  const my = s.match(/^(\d{1,2})[\/\-](\d{2})$/);
  if (my) {
    const fullYear = Number(my[2]) < 50 ? 2000 + Number(my[2]) : 1900 + Number(my[2]);
    return fullYear * 10000 + Number(my[1]) * 100;
  }
  return null;
}

/**
 * Sort events chronologically. Events with unknown dates are
 * placed at the end (after all dated events), maintaining their
 * original relative order.
 */
export function sortEventsChronologically<T extends SortableEvent>(events: T[]): T[] {
  // We want a stable sort: pair each event with its original index.
  // Events with unknown dates are placed at the end, sorted by id.
  const decorated = events.map((e, i) => ({
    event: e,
    originalIndex: i,
    sortKey: parseDateToSortKey(e.date),
  }));
  decorated.sort((a, b) => {
    // Both have known dates: sort by date ascending
    if (a.sortKey !== null && b.sortKey !== null) {
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
      // Tie-break by mutationNumber / docNo
      const aDoc = a.event.mutationNumber ?? a.event.docNo ?? "";
      const bDoc = b.event.mutationNumber ?? b.event.docNo ?? "";
      if (aDoc !== bDoc) return aDoc.localeCompare(bDoc);
      // Last-resort: id lexicographic
      return a.event.id.localeCompare(b.event.id);
    }
    // Dated events come first
    if (a.sortKey !== null) return -1;
    if (b.sortKey !== null) return 1;
    // Both undated: stable by original index
    if (a.originalIndex !== b.originalIndex) return a.originalIndex - b.originalIndex;
    return a.event.id.localeCompare(b.event.id);
  });
  return decorated.map((d) => d.event);
}
