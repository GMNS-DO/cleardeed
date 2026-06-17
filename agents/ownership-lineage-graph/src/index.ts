/**
 * P3 V1 — Ownership Lineage Graph (A13) main entry point.
 *
 * Plan §4.1: V1 is data layer only. No SVG, no Dagre. The agent
 * returns nodes/edges/events/flags/summary/layout and the renderer
 * at buildRoRBackPagePanel renders a bullet list + flag badges.
 *
 * Determinism:
 *   - sort.ts uses parseDateToSortKey + mutationNumber tie-break
 *   - node IDs are derived from names (not random UUIDs) so repeat
 *     inputs produce identical node IDs
 *   - sortEventsChronologically is called once on input; result is
 *     the canonical order
 *
 * Plan §4.5 (note — V1 doesn't use dagre yet; reserved for V2)
 *
 * Plan §4.2 layout.mode: V1 returns "list" only. The chooseLayoutMode
 * function is exported for the V2 SVG/timeline renderer to call.
 */

import type {
  A13Input,
  A13Result,
  LineageEvent,
  LineageNode,
  LineageEdge,
  RedFlag,
  Layout,
  LayoutMode,
} from "./schema";
import { A13ResultSchema, A13InputSchema } from "./schema";
import { parseDateToSortKey } from "./sort";
import { detectRedFlags } from "./red-flags";
import { sortEventsChronologically } from "./sort";
import { joinEventsToEc, attachCrossRefs } from "./cross-ref";

/** Threshold for switching to "list" mode (plan §4.7 test fixture). */
const LIST_THRESHOLD = 50;

/** Decide which layout mode the renderer should use.
 *  V1 always returns "list". V2 introduces the thresholds:
 *    - 80+ nodes -> "list"
 *    - 20+ nodes + desktop -> "svg"
 *    - 20+ nodes + mobile  -> "timeline"
 *  This stub is exported so the V2 renderer can call it. */
export function chooseLayoutMode(
  nodeCount: number,
  viewport: "mobile" | "desktop" | "unknown",
): Layout {
  // Plan §4.2 V2 thresholds. 80+ nodes -> list (browser perf).
  // Mobile + 20+ -> timeline (vertical, narrow).
  // Desktop OR unknown (server-rendered, default to desktop) + 20+ -> svg.
  // < 20 nodes -> list (the bullet view is sufficient for small chains).
  if (nodeCount >= 80) {
    return { mode: "list", width: 600, height: 0, reason: "node_count>=80" };
  }
  if (viewport === "mobile" && nodeCount >= 20) {
    return { mode: "timeline", width: 360, height: 600, reason: "mobile+node_count>=20" };
  }
  if (nodeCount >= 20) {
    // Treat "unknown" as desktop: the report HTML is server-rendered
    // and the client can scroll horizontally on a narrow viewport.
    const reason =
      viewport === "unknown"
        ? "node_count>=20+default_desktop"
        : "node_count>=20+desktop";
    return { mode: "svg", width: 800, height: 600, reason };
  }
  return { mode: "list", width: 600, height: 0, reason: "default" };
}

/** Build a stable node ID from a name. */
function makeNodeId(name: string, role: string): string {
  return `node:${role}:${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
}

/** Build a stable event ID from mutation history entry. */
function makeEventId(plotNo: string, index: number, docNo?: string, date?: string): string {
  return `evt:${plotNo}:${docNo ?? date ?? String(index)}`;
}

/** Heuristic: classify a mutation entry's kind from the rawText or docType. */
function classifyKind(rawText?: string, docType?: string): LineageEvent["kind"] {
  const text = `${rawText ?? ""} ${docType ?? ""}`.toLowerCase();
  if (/mortgage|charge/.test(text)) return "mortgage";
  if (/release|reconveyance|satisfaction/.test(text)) return "release";
  if (/partition|division/.test(text)) return "partition";
  if (/inheritance|heir|succession|will|deceased/.test(text)) return "inheritance";
  if (/lease|rent/.test(text)) return "lease";
  if (/sale|deed|transfer|conveyance|purchase/.test(text)) return "sale";
  return "other";
}

/** Heuristic: classify an encumbrance entry. */
function classifyEncumbrance(type?: string): LineageEvent["kind"] {
  if (!type) return "other";
  const t = type.toLowerCase();
  if (/mortgage|charge/.test(t)) return "mortgage";
  if (/release|reconveyance|satisfaction/.test(t)) return "release";
  if (/lease/.test(t)) return "lease";
  return "other";
}

/** Heuristic: build a display title for a mutation event. */
function buildDisplayName(
  kind: LineageEvent["kind"],
  fromParty?: string,
  toParty?: string,
  plotNo?: string,
): string {
  const plot = plotNo ? ` on plot ${plotNo}` : "";
  switch (kind) {
    case "sale":
      return `Sale${fromParty && toParty ? ` from ${fromParty} to ${toParty}` : ""}${plot}`;
    case "mortgage":
      return `Mortgage${toParty ? ` with ${toParty}` : ""}${plot}`;
    case "release":
      return `Release${toParty ? ` by ${toParty}` : ""}${plot}`;
    case "partition":
      return `Partition${plot}`;
    case "inheritance":
      return `Inheritance transfer${fromParty ? ` from ${fromParty}` : ""}${plot}`;
    case "lease":
      return `Lease${toParty ? ` to ${toParty}` : ""}${plot}`;
    default:
      return `Event${plot}`;
  }
}

/** Heuristic: derive confidence from input quality. */
function deriveConfidence(input: A13Input, nodeCount: number, eventCount: number): number {
  let conf = 0.5;
  // Has tenants -> we know the end of the chain
  if (input.tenants.length > 0) conf += 0.15;
  // Has encumbrance entries -> more data
  if (input.encumbranceEntries.length > 0) conf += 0.1;
  // Has mutation history
  if (input.mutationHistory.length > 0) conf += 0.1;
  // Has party names on mutations
  const hasParties = input.mutationHistory.some((m) => (m.parties?.length ?? 0) > 0);
  if (hasParties) conf += 0.15;
  // Penalty for very few events (single-transfer plots are overconfident)
  if (eventCount < 2) conf -= 0.15;
  return Math.max(0.1, Math.min(1, conf));
}

/**
 * The main A13 entry point.
 *
 * @param input - Plot lineage input (mutation history, encumbrance, tenants)
 * @returns A13Result with nodes/edges/events/flags/summary/layout/confidence
 */
export function reasonA13(input: A13Input): A13Result {
  // Validate input — fail loud in dev/test
  const parsed = A13InputSchema.parse(input);

  // 1. Build events from mutation history
  const mutationEvents: LineageEvent[] = parsed.mutationHistory.map((m, i) => {
    const kind = classifyKind(m.rawText, m.docType);
    // Role matching is intentionally permissive: partition, inheritance,
    // and other kinds use different terminology. We accept any party
    // that is NOT a "co-sharer" or "witness" as either a fromParty or
    // toParty; the heuristic is "first non-co-sharer party is from, last
    // is to".
    const mainParties = m.parties?.filter(
      (p) => !/co-?sharer|witness/i.test(p.role ?? "")
    ) ?? [];
    const fromParty = mainParties[0]?.name;
    const toParty = mainParties[mainParties.length - 1]?.name;
    return {
      id: makeEventId(parsed.plotNo, i, m.mutationNumber, m.mutationDate),
      date: m.mutationDate ?? "",
      kind,
      docNo: m.mutationNumber,
      plotNo: m.plotNo ?? parsed.plotNo,
      fromParty,
      toParty,
      displayName: buildDisplayName(kind, fromParty, toParty, m.plotNo ?? parsed.plotNo),
      rawText: m.rawText,
    };
  });

  // 2. Build events from encumbrance entries
  const encumbranceEvents: LineageEvent[] = parsed.encumbranceEntries.map((e, i) => {
    const kind = classifyEncumbrance(e.type);
    return {
      id: `enc:${parsed.plotNo}:${e.docNo ?? String(i)}`,
      date: e.date ?? "",
      kind,
      docNo: e.docNo,
      plotNo: parsed.plotNo,
      fromParty: undefined,
      toParty: e.partyName,
      displayName: buildDisplayName(kind, undefined, e.partyName, parsed.plotNo),
      rawText: e.description,
    };
  });

  // 3. Sort all events chronologically
  const allEvents = sortEventsChronologically([...mutationEvents, ...encumbranceEvents]);

  // 1b. Plan §4.5: cross-document reference join. For each event
  // whose docNo matches an IGR EC entry's docNo (after normalise),
  // attach a `crossRef` badge. V3 in-report only.
  let eventsWithCrossRefs: LineageEvent[] = allEvents;
  if (parsed.igrEcEntries && parsed.igrEcEntries.length > 0) {
    const badges = joinEventsToEc(allEvents, parsed.igrEcEntries, {
      reportId: parsed.plotNo, // The plot no is the report's de-facto ID within A13
    });
    if (badges.size > 0) {
      eventsWithCrossRefs = attachCrossRefs(allEvents, badges);
    }
  }

  // 4. Build nodes — one node per unique person/entity referenced
  const nodeMap = new Map<string, LineageNode>();
  for (const event of allEvents) {
    if (event.fromParty) {
      const id = makeNodeId(event.fromParty, "person");
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id,
          displayName: event.fromParty,
          kind: "person",
          role: "transferor",
          firstSeen: event.date,
        });
      } else {
        const existing = nodeMap.get(id)!;
        if (event.date && (!existing.firstSeen || event.date < existing.firstSeen)) {
          existing.firstSeen = event.date;
        }
      }
    }
    if (event.toParty) {
      const id = makeNodeId(event.toParty, "person");
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id,
          displayName: event.toParty,
          kind: "person",
          role: "transferee",
          firstSeen: event.date,
        });
      } else {
        const existing = nodeMap.get(id)!;
        if (event.date && (!existing.firstSeen || event.date < existing.firstSeen)) {
          existing.firstSeen = event.date;
        }
      }
    }
  }

  // Add co-sharer parties as standalone nodes (they are referenced in
  // the lineage even if they are not the from/to party of an event).
  for (const m of parsed.mutationHistory) {
    if (!m.parties) continue;
    for (const p of m.parties) {
      if (!/co-?sharer/i.test(p.role ?? "")) continue;
      if (!p.name) continue;
      const id = makeNodeId(p.name, "person");
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id,
          displayName: p.name,
          kind: "person",
          role: "co-sharer",
        });
      }
    }
  }

  // Add a node for each current tenant
  for (const tenant of parsed.tenants) {
    if (!tenant.tenantName) continue;
    const id = makeNodeId(tenant.tenantName, "person");
    if (!nodeMap.has(id)) {
      nodeMap.set(id, {
        id,
        displayName: tenant.tenantName,
        kind: "person",
        role: "current_owner",
      });
    }
  }

  // 5. Build edges — relationship between nodes for each event
  const edges: LineageEdge[] = [];
  for (const event of allEvents) {
    // For mortgage/release: connect the plot owner to the bank/creditor
    // (we don't have a fromParty, so we use the current tenant).
    // For sale/inheritance/partition: connect fromParty to toParty.
    if (event.kind === "mortgage" || event.kind === "release") {
      if (!event.toParty) continue;
      // Use the first tenant as the from-party (mortgagor)
      const tenant = parsed.tenants[0]?.tenantName;
      if (!tenant) continue;
      const fromId = makeNodeId(tenant, "person");
      const toId = makeNodeId(event.toParty, "person");
      const relationship = event.kind === "mortgage" ? "mortgaged_to" : "released_by";
      edges.push({
        fromNodeId: fromId,
        toNodeId: toId,
        relationship,
        eventIds: [event.id],
        documentType: event.kind,
      });
      continue;
    }
    if (!event.fromParty || !event.toParty) continue;
    const fromId = makeNodeId(event.fromParty, "person");
    const toId = makeNodeId(event.toParty, "person");
    const relationship =
      event.kind === "sale" ? "sold_to" :
      event.kind === "inheritance" ? "inherited_by" :
      "owned_by";
    edges.push({
      fromNodeId: fromId,
      toNodeId: toId,
      relationship,
      eventIds: [event.id],
      documentType: event.kind,
    });
  }

  // 6. Compute summary (count-only, plan §4.4)
  const owners = nodeMap.size;
  const eventsCount = allEvents.length;

  // Build partition co-sharer counts for red-flag detection
  const partitionCoSharerCounts: Record<string, number> = {};
  for (const m of parsed.mutationHistory) {
    if (m.parties && m.parties.length > 0) {
      const kind = classifyKind(m.rawText, m.docType);
      if (kind === "partition") {
        const eventId = makeEventId(parsed.plotNo, parsed.mutationHistory.indexOf(m), m.mutationNumber, m.mutationDate);
        const coSharers = m.parties.filter((p) => /co-?sharer/i.test(p.role ?? "")).length;
        partitionCoSharerCounts[eventId] = coSharers;
      }
    }
  }

  const flags = detectRedFlags(
    allEvents.map((e) => ({ id: e.id, kind: e.kind, date: e.date })),
    parsed.encumbranceEntries,
    partitionCoSharerCounts,
  );
  const criticalCount = flags.filter((f) => f.severity === "critical").length;
  const warnCount = flags.filter((f) => f.severity === "warn").length;
  const infoCount = flags.filter((f) => f.severity === "info").length;
  // Per plan: only ONE severity tier in the summary — pick the
  // highest-severity that is non-zero.
  let summary: string;
  if (criticalCount > 0) {
    summary = `${eventsCount} event${eventsCount === 1 ? "" : "s"}, ${owners} owner${owners === 1 ? "" : "s"}, ${criticalCount} critical flag${criticalCount === 1 ? "" : "s"}`;
  } else if (warnCount > 0) {
    summary = `${eventsCount} event${eventsCount === 1 ? "" : "s"}, ${owners} owner${owners === 1 ? "" : "s"}, ${warnCount} warn flag${warnCount === 1 ? "" : "s"}`;
  } else if (infoCount > 0) {
    summary = `${eventsCount} event${eventsCount === 1 ? "" : "s"}, ${owners} owner${owners === 1 ? "" : "s"}, ${infoCount} info flag${infoCount === 1 ? "" : "s"}`;
  } else {
    summary = `${eventsCount} event${eventsCount === 1 ? "" : "s"}, ${owners} owner${owners === 1 ? "" : "s"}`;
  }

  // 7. Layout decision
  const layout = chooseLayoutMode(owners, parsed.viewport);

  // 8. Confidence
  const confidence = deriveConfidence(parsed, owners, eventsCount);

  // 9. Build result
  const result: A13Result = {
    nodes: [...nodeMap.values()],
    edges,
    events: eventsWithCrossRefs,
    flags,
    summary,
    layout,
    confidence,
  };

  // 10. Validate — fail loud if anything is wrong
  return A13ResultSchema.parse(result);
}

/** Re-export the schema types and helpers for consumers. */
export * from "./schema";
export { detectRedFlags, RED_FLAGS, summarizeEvents } from "./red-flags";
export { sortEventsChronologically, parseDateToSortKey } from "./sort";
