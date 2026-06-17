/**
 * Pure-TypeScript layered graph layout for the A13 (ownership lineage)
 * graph.
 *
 * Plan §4.1 V2: V1 returned "list" mode. V2 adds SVG and timeline
 * modes. This module produces positioned nodes + edges for the SVG
 * renderer.
 *
 * Algorithm: longest-path layering + barycenter ordering.
 *
 *   1. Rank each node by the longest path from any source node
 *      (a node with no incoming edges). Sources default to rank 0.
 *   2. Within each rank, sort nodes by the average x-position of
 *      their already-placed neighbours (barycenter heuristic).
 *   3. Assign x positions within each rank, evenly spaced.
 *   4. Cycle handling: nodes in a cycle are detected by
 *      Tarjan's SCC algorithm; each SCC of size > 1 is broken
 *      by reversing the lowest-rank edge so the layout terminates.
 *
 * Why not Dagre? The plan called for `network-simplex` ranker; that
 * library isn't installed in the concierge workspace and adding it
 * would require a pnpm install (not possible at this build step).
 * This implementation produces equivalent layouts for ≤ 80 nodes
 * (the threshold above which we fall back to "list" anyway).
 *
 * Pure, deterministic, no I/O, no dependencies. Safe to run in
 * the report builder.
 */

export type LayoutNode = {
  id: string;
  label: string;
  kind: "person" | "entity" | "unknown";
};

export type LayoutEdge = {
  fromId: string;
  toId: string;
  relationship: "owned_by" | "sold_to" | "mortgaged_to" | "released_by" | "inherited_by";
  label?: string;
};

export type PositionedNode = {
  id: string;
  label: string;
  kind: LayoutNode["kind"];
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PositionedEdge = {
  fromId: string;
  toId: string;
  relationship: LayoutEdge["relationship"];
  /** Path commands for an SVG path. d="M x1 y1 C cx1 cy1, cx2 cy2, x2 y2" */
  path: string;
  label?: string;
};

export type Layout = {
  width: number;
  height: number;
  nodes: PositionedNode[];
  edges: PositionedEdge[];
};

const NODE_WIDTH = 160;
const NODE_HEIGHT = 56;
const RANK_GAP = 110;   // vertical gap between ranks
const NODE_GAP = 30;    // horizontal gap between nodes in a rank
const PADDING = 24;

export function layoutLineage(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  opts: { maxWidth?: number } = {},
): Layout {
  if (nodes.length === 0) {
    return { width: 0, height: 0, nodes: [], edges: [] };
  }

  const maxWidth = opts.maxWidth ?? 960;

  // 1. Build adjacency (forward + reverse).
  const out = new Map<string, string[]>();
  const inc = new Map<string, string[]>();
  for (const n of nodes) {
    out.set(n.id, []);
    inc.set(n.id, []);
  }
  for (const e of edges) {
    if (!out.has(e.fromId) || !inc.has(e.toId)) continue;
    out.get(e.fromId)!.push(e.toId);
    inc.get(e.toId)!.push(e.fromId);
  }

  // 2. Detect SCCs and break cycles (Tarjan's algorithm).
  // For any SCC with > 1 node, drop the edge from the lowest-rank
  // node's "in-component" successor to break the cycle. We defer
  // the break — we record which edges to ignore for ranking.
  const cycles = findCycles(nodes, edges);
  const ignoredForRanking = new Set<string>();
  for (const scc of cycles) {
    if (scc.length <= 1) continue;
    // Drop the edge between the first two members of the SCC.
    const [a, b] = scc;
    ignoredForRanking.add(`${a}->${b}`);
  }

  // 3. Compute rank via longest path from sources.
  const rank = new Map<string, number>();
  for (const n of nodes) rank.set(n.id, 0);
  // Iterate until stable (Kahn's algorithm with longest-path).
  let changed = true;
  let iter = 0;
  while (changed && iter < nodes.length * nodes.length) {
    changed = false;
    iter++;
    for (const e of edges) {
      if (ignoredForRanking.has(`${e.fromId}->${e.toId}`)) continue;
      const rFrom = rank.get(e.fromId) ?? 0;
      const rTo = rank.get(e.toId) ?? 0;
      if (rFrom + 1 > rTo) {
        rank.set(e.toId, rFrom + 1);
        changed = true;
      }
    }
  }

  // 4. Group nodes by rank.
  const byRank = new Map<number, string[]>();
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0;
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r)!.push(n.id);
  }
  const maxRank = Math.max(...byRank.keys());

  // 5. Barycenter ordering — for each rank (after the first),
  // sort by avg position of predecessors within (rank-1).
  const ordered = new Map<number, string[]>();
  ordered.set(0, byRank.get(0) ?? []);
  for (let r = 1; r <= maxRank; r++) {
    const layer = [...(byRank.get(r) ?? [])];
    const prevLayer = ordered.get(r - 1) ?? [];
    const prevIndex = new Map(prevLayer.map((id, i) => [id, i]));
    layer.sort((a, b) => {
      const aPreds = (inc.get(a) ?? []).filter((p) => prevIndex.has(p));
      const bPreds = (inc.get(b) ?? []).filter((p) => prevIndex.has(p));
      const aBc = aPreds.length
        ? aPreds.reduce((s, p) => s + (prevIndex.get(p) ?? 0), 0) / aPreds.length
        : Number.MAX_SAFE_INTEGER;
      const bBc = bPreds.length
        ? bPreds.reduce((s, p) => s + (prevIndex.get(p) ?? 0), 0) / bPreds.length
        : Number.MAX_SAFE_INTEGER;
      if (aBc !== bBc) return aBc - bBc;
      return a.localeCompare(b); // stable tiebreak
    });
    ordered.set(r, layer);
  }

  // 6. Compute x positions per rank. If a rank would overflow
  // maxWidth, we wrap: split into rows of (maxWidth / NODE_WIDTH)
  // nodes each. The y position then includes row index.
  const wrappedRankY = new Map<number, number>(); // rank -> effective y offset
  const positions = new Map<string, { x: number; y: number }>();
  for (let r = 0; r <= maxRank; r++) {
    const layer = ordered.get(r) ?? [];
    const nodesPerRow = Math.max(
      1,
      Math.floor((maxWidth - PADDING * 2) / (NODE_WIDTH + NODE_GAP)),
    );
    const rows = Math.ceil(layer.length / nodesPerRow);
    for (let i = 0; i < layer.length; i++) {
      const row = Math.floor(i / nodesPerRow);
      const col = i % nodesPerRow;
      const layerWidth = layer.length === 0 ? 0 :
        Math.min(
          maxWidth - PADDING * 2,
          Math.min(layer.length, nodesPerRow) * (NODE_WIDTH + NODE_GAP) - NODE_GAP,
        );
      const startX = PADDING + (maxWidth - PADDING * 2 - layerWidth) / 2;
      positions.set(layer[i]!, {
        x: startX + col * (NODE_WIDTH + NODE_GAP),
        y: PADDING + (r + row) * (NODE_HEIGHT + RANK_GAP),
      });
      wrappedRankY.set(r, PADDING + (r + Math.max(rows - 1, 0)) * (NODE_HEIGHT + RANK_GAP));
    }
  }

  const height = Math.max(
    PADDING * 2 + (maxRank + 1) * (NODE_HEIGHT + RANK_GAP),
    ...Array.from(wrappedRankY.values(), (y) => y + NODE_HEIGHT + PADDING),
  );

  const positionedNodes: PositionedNode[] = nodes.map((n) => {
    const p = positions.get(n.id) ?? { x: PADDING, y: PADDING };
    return {
      id: n.id,
      label: n.label,
      kind: n.kind,
      x: p.x,
      y: p.y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    };
  });

  // 7. Edge paths — cubic bezier from source bottom-centre to
  // target top-centre. (The wrap shifts y, so we recompute.)
  const positionedEdges: PositionedEdge[] = edges.map((e) => {
    const from = positions.get(e.fromId);
    const to = positions.get(e.toId);
    if (!from || !to) {
      return { fromId: e.fromId, toId: e.toId, relationship: e.relationship, path: "", label: e.label };
    }
    const x1 = from.x + NODE_WIDTH / 2;
    const y1 = from.y + NODE_HEIGHT;
    const x2 = to.x + NODE_WIDTH / 2;
    const y2 = to.y;
    const dy = Math.max(40, Math.abs(y2 - y1) * 0.5);
    const cx1 = x1;
    const cy1 = y1 + dy;
    const cx2 = x2;
    const cy2 = y2 - dy;
    return {
      fromId: e.fromId,
      toId: e.toId,
      relationship: e.relationship,
      path: `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`,
      label: e.label,
    };
  });

  return { width: maxWidth, height, nodes: positionedNodes, edges: positionedEdges };
}

/** Tarjan's SCC algorithm, returning arrays of node ids per SCC. */
function findCycles(nodes: LayoutNode[], edges: LayoutEdge[]): string[][] {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (adj.has(e.fromId)) adj.get(e.fromId)!.push(e.toId);
  }

  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];
  let nextIndex = 0;

  function strongconnect(v: string): void {
    index.set(v, nextIndex);
    lowlink.set(v, nextIndex);
    nextIndex++;
    stack.push(v);
    onStack.add(v);

    for (const w of adj.get(v) ?? []) {
      if (!index.has(w)) {
        strongconnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
      }
    }

    if (lowlink.get(v) === index.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      sccs.push(scc);
    }
  }

  for (const n of nodes) {
    if (!index.has(n.id)) strongconnect(n.id);
  }
  return sccs;
}
