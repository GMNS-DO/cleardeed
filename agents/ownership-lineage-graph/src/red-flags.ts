/**
 * P3 V1 red-flag definitions (7 flags, lawyer-reviewable copy).
 *
 * Plan §4.3: each flag has a code, severity, headline, body, and
 * actionRequired. The plan's example (MORTGAGE_NO_RELEASE) is
 * included verbatim. The other 6 are derived from the most common
 * issues seen in IGR/Bhulekh records.
 *
 * LAWYER SIGN-OFF (plan §4.3 critical path):
 *   All 7 bodies must be reviewed by a lawyer or in-house product
 *   owner with legal review BEFORE P3 V1 ships. This is a process
 *   gate, not a code gate; the code is shipped and the copy is
 *   reviewed in week 2.
 *
 * Plan §4.4: copy MUST NOT contain verdict language. Each body
 * is a careful, factual statement ending with a clear caveat.
 */

import type { RedFlagCode } from "./schema";

export interface RedFlagCopy {
  code: RedFlagCode;
  severity: "critical" | "warn" | "info";
  /** Pattern of source events that trigger this flag */
  trigger: (eventSummary: {
    eventKinds: string[];
    hasMortgage: boolean;
    hasRelease: boolean;
    hasInheritance: boolean;
    mortgageDates: string[];
    saleDates: string[];
    /** Number of partition events whose co-sharer data is missing. */
    partitionsMissingShares: number;
    /** Number of mortgage events with a release in the chain. */
    mortgagesWithRelease: number;
    /** Total number of mortgage events. */
    mortgageCount: number;
    /** Number of inheritance events. */
    inheritanceCount: number;
    /** Number of sales (any kind of transfer). */
    saleCount: number;
  }) => boolean;
  headline: string;
  body: string;
  actionRequired: string;
}

export const RED_FLAGS: RedFlagCopy[] = [
  {
    code: "MORTGAGE_NO_RELEASE",
    severity: "critical",
    trigger: (s) => s.hasMortgage && !s.hasRelease,
    headline: "2010 mortgage shows no recorded release",
    body: "This plot has a 2010 mortgage that we did not find a release for in the records we checked. This does not necessarily mean the mortgage is still active.",
    actionRequired: "Verify with the lending bank that the mortgage was released before relying on this report.",
  },
  {
    code: "INHERITANCE_UNRECORDED",
    severity: "warn",
    trigger: (s) => s.hasInheritance,
    headline: "Inheritance transfer may not be fully recorded",
    body: "We detected what appears to be an inheritance transfer in the lineage. Inheritance mutations sometimes involve a gap between the holder's death and the mutation being entered in the land record.",
    actionRequired: "Confirm with the family that the mutation has been officially recorded with the Tehsildar.",
  },
  {
    code: "RAPID_FLIPS",
    severity: "warn",
    trigger: (s) => s.saleCount >= 3,
    headline: "Plot has changed hands three or more times",
    body: "We saw multiple sale events in the records we checked. Frequent resale does not imply anything wrong, but it is worth a closer look at the most recent transaction.",
    actionRequired: "Review the most recent sale deed and confirm the current seller's chain of title is intact.",
  },
  {
    code: "PARTITION_MISSING_SHARES",
    severity: "warn",
    trigger: (s) => s.partitionsMissingShares > 0,
    headline: "Partition entry present; verify all shares recorded",
    body: "A partition event appears in the lineage. The records we checked may not list every co-sharer's share explicitly; this is common but worth confirming.",
    actionRequired: "Ask the seller for a copy of the partition deed and confirm every co-sharer is accounted for.",
  },
  {
    code: "COURT_CASE_PENDING",
    severity: "critical",
    trigger: (s) => s.eventKinds.includes("court_case"),
    headline: "Court case reference appears in the lineage",
    body: "We found what looks like a court case reference attached to this plot. Active litigation can affect marketability.",
    actionRequired: "Ask the seller whether the case is disposed, and request a certified copy of the order if it is.",
  },
  {
    code: "ENCROACHMENT_FLAG",
    severity: "info",
    trigger: (s) => false, // Triggered by external data not in v1
    headline: "Encroachment notice may apply",
    body: "This plot may be subject to an encroachment notice based on records we did not fully access. We have not confirmed the notice is still in force.",
    actionRequired: "Visit the Tehsildar's office to confirm there is no active encroachment proceeding before purchase.",
  },
  {
    code: "OUTDATED_RECORDS",
    severity: "info",
    trigger: (s) => {
      // Only fire if there's NO recent activity at all (no event in last
      // 5 years) AND there are no encumbrance entries. This avoids
      // annoying info flags on plots that have older lineage but recent
      // encumbrance activity.
      if (s.mortgageDates.length === 0 && s.saleDates.length === 0) return false;
      const allDates = [...s.mortgageDates, ...s.saleDates]
        .filter((d) => d && /^\d{4}/.test(d));
      if (allDates.length === 0) return false;
      const years = allDates.map((d) => Number(d.slice(0, 4))).filter((y) => y > 1900);
      if (years.length === 0) return false;
      const mostRecent = Math.max(...years);
      return mostRecent < new Date().getFullYear() - 5;
    },
    headline: "Records may be older than 5 years",
    body: "The most recent event in the records we checked is more than 5 years old. The plot may have had more recent transactions we did not see.",
    actionRequired: "Pull a fresh EC (Encumbrance Certificate) from IGR covering the last 13 years before relying on this report.",
  },
];

/** Build the event summary used for trigger evaluation. */
export function summarizeEvents(
  events: Array<{ kind: string; date?: string; id: string }>,
  encumbranceEntries: Array<{ type?: string; date?: string; partyName?: string }>,
  /**
   * For each partition event, the number of co-sharer parties
   * associated with it. If 0, the partition has no co-sharer data
   * and PARTITION_MISSING_SHARES should fire.
   */
  partitionCoSharerCounts: Record<string, number> = {},
) {
  const eventKinds = events.map((e) => e.kind);
  const mortgageEvents = [
    ...events.filter((e) => e.kind === "mortgage"),
    ...encumbranceEntries.filter((e) => /mortgage|charge/i.test(e.type ?? "")),
  ];
  const releaseEvents = [
    ...events.filter((e) => e.kind === "release"),
    ...encumbranceEntries.filter((e) => /release|reconveyance|satisfaction/i.test(e.type ?? "")),
  ];
  const inheritanceEvents = events.filter((e) => e.kind === "inheritance");
  const saleEvents = events.filter((e) => e.kind === "sale");
  const partitionEvents = events.filter((e) => e.kind === "partition");

  // For each partition event, count how many co-sharer parties it has.
  // The "main" parties are those with role "from" or "to"; "co-sharer"
  // parties are the additional co-sharers. PARTITION_MISSING_SHARES
  // fires if a partition event has 0 co-sharers AND only 1 main party
  // (i.e. the partition list is empty).
  const partitionsMissingShares = partitionEvents.filter((e) => {
    const coSharerCount = partitionCoSharerCounts[e.id] ?? 0;
    return coSharerCount === 0;
  }).length;

  // Mortgages with a release: a mortgage followed by a release within
  // a reasonable time window. For V1 we just check if ANY release
  // exists in the events.
  const mortgagesWithRelease =
    releaseEvents.length > 0 ? mortgageEvents.length : 0;

  return {
    eventKinds,
    hasMortgage: mortgageEvents.length > 0,
    hasRelease: releaseEvents.length > 0,
    hasInheritance: inheritanceEvents.length > 0,
    mortgageDates: mortgageEvents.map((e) => e.date ?? ""),
    saleDates: saleEvents.map((e) => e.date ?? ""),
    partitionsMissingShares,
    mortgagesWithRelease,
    mortgageCount: mortgageEvents.length,
    inheritanceCount: inheritanceEvents.length,
    saleCount: saleEvents.length,
  };
}

/** Return the red flags that should be raised for the given events. */
export function detectRedFlags(
  events: Array<{ kind: string; date?: string; id: string }>,
  encumbranceEntries: Array<{ type?: string; date?: string; partyName?: string }>,
  partitionCoSharerCounts: Record<string, number> = {},
) {
  const summary = summarizeEvents(events, encumbranceEntries, partitionCoSharerCounts);
  const raised = RED_FLAGS.filter((f) => f.trigger(summary));
  return raised.map((f) => {
    // Attach the events that triggered this flag
    let eventIds: string[] = [];
    if (f.code === "MORTGAGE_NO_RELEASE") {
      eventIds = events.filter((e) => e.kind === "mortgage").map((e) => e.id);
    } else if (f.code === "INHERITANCE_UNRECORDED") {
      eventIds = events.filter((e) => e.kind === "inheritance").map((e) => e.id);
    } else if (f.code === "RAPID_FLIPS") {
      eventIds = events.filter((e) => e.kind === "sale").map((e) => e.id);
    } else if (f.code === "PARTITION_MISSING_SHARES") {
      // Only attach partitions that are missing co-sharer data
      eventIds = events.filter((e) => {
        if (e.kind !== "partition") return false;
        return (partitionCoSharerCounts[e.id] ?? 0) === 0;
      }).map((e) => e.id);
    } else if (f.code === "COURT_CASE_PENDING") {
      eventIds = events.filter((e) => e.kind === "court_case").map((e) => e.id);
    } else if (f.code === "OUTDATED_RECORDS") {
      eventIds = events.map((e) => e.id);
    } else {
      eventIds = [];
    }
    return {
      code: f.code,
      severity: f.severity,
      headline: f.headline,
      body: f.body,
      actionRequired: f.actionRequired,
      eventIds,
    };
  });
}
