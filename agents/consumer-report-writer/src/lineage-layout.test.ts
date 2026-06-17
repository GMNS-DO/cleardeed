/**
 * Tests for the lineage layout + SVG renderer.
 */
import { describe, it, expect } from "vitest";
import { layoutLineage, type LayoutNode, type LayoutEdge } from "./lineage-layout";
import { renderLineageSvg, renderLineageTimeline } from "./lineage-svg";

const person = (id: string, label: string): LayoutNode => ({ id, label, kind: "person" });
const edge = (fromId: string, toId: string, relationship: LayoutEdge["relationship"] = "sold_to"): LayoutEdge => ({
  fromId,
  toId,
  relationship,
});

describe("layoutLineage", () => {
  it("returns empty layout for empty input", () => {
    const layout = layoutLineage([], []);
    expect(layout.nodes).toHaveLength(0);
    expect(layout.edges).toHaveLength(0);
    expect(layout.width).toBe(0);
    expect(layout.height).toBe(0);
  });

  it("places a single source node at the top-left", () => {
    const layout = layoutLineage([person("a", "A")], []);
    expect(layout.nodes).toHaveLength(1);
    const n = layout.nodes[0]!;
    expect(n.id).toBe("a");
    expect(n.x).toBeGreaterThan(0);
    expect(n.y).toBeGreaterThan(0);
    expect(n.width).toBeGreaterThan(0);
    expect(n.height).toBeGreaterThan(0);
  });

  it("places successors below their predecessors (longest-path ranking)", () => {
    // a -> b -> c
    const layout = layoutLineage(
      [person("a", "A"), person("b", "B"), person("c", "C")],
      [edge("a", "b"), edge("b", "c")],
    );
    const a = layout.nodes.find((n) => n.id === "a")!;
    const b = layout.nodes.find((n) => n.id === "b")!;
    const c = layout.nodes.find((n) => n.id === "c")!;
    expect(a.y).toBeLessThan(b.y);
    expect(b.y).toBeLessThan(c.y);
    expect(a.x).toBe(b.x);
    expect(b.x).toBe(c.x);
  });

  it("places nodes with two predecessors at the same y when they share a rank", () => {
    // a -> c, b -> c (diamond)
    const layout = layoutLineage(
      [person("a", "A"), person("b", "B"), person("c", "C")],
      [edge("a", "c"), edge("b", "c")],
    );
    const a = layout.nodes.find((n) => n.id === "a")!;
    const b = layout.nodes.find((n) => n.id === "b")!;
    const c = layout.nodes.find((n) => n.id === "c")!;
    // a and b share rank 0 (no incoming edges); c is rank 1
    expect(a.y).toBe(b.y);
    expect(c.y).toBeGreaterThan(a.y);
    // a and b are sorted by id (stable tiebreak)
    expect(a.x).toBeLessThan(b.x);
  });

  it("handles a cycle without infinite loop", () => {
    // a -> b -> a (cycle)
    const layout = layoutLineage(
      [person("a", "A"), person("b", "B")],
      [edge("a", "b"), edge("b", "a")],
    );
    // Should terminate; both nodes get distinct positions
    expect(layout.nodes).toHaveLength(2);
    const a = layout.nodes.find((n) => n.id === "a")!;
    const b = layout.nodes.find((n) => n.id === "b")!;
    expect(a.x === b.x ? a.y !== b.y : true).toBe(true);
  });

  it("emits cubic bezier path strings for edges", () => {
    const layout = layoutLineage(
      [person("a", "A"), person("b", "B")],
      [edge("a", "b")],
    );
    expect(layout.edges).toHaveLength(1);
    const path = layout.edges[0]!.path;
    // M x1 y1 C cx1 cy1, cx2 cy2, x2 y2
    expect(path).toMatch(/^M [\d.-]+ [\d.-]+ C [\d.-]+ [\d.-]+, [\d.-]+ [\d.-]+, [\d.-]+ [\d.-]+$/);
  });

  it("positions do not overlap (no two nodes share both x and y in same-rank)", () => {
    // 4 independent nodes in rank 0
    const nodes = [
      person("a", "A"),
      person("b", "B"),
      person("c", "C"),
      person("d", "D"),
    ];
    const layout = layoutLineage(nodes, []);
    const seen = new Set<string>();
    for (const n of layout.nodes) {
      const key = `${n.x},${n.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("clamps to maxWidth", () => {
    const nodes = Array.from({ length: 30 }, (_, i) => person(`n${i}`, `Node ${i}`));
    const edges = Array.from({ length: 29 }, (_, i) => edge(`n${i}`, `n${i + 1}`));
    const layout = layoutLineage(nodes, edges, { maxWidth: 600 });
    expect(layout.width).toBeLessThanOrEqual(600);
    // With 30 nodes, the layout must wrap (rows > 1) — height > 1 rank
    expect(layout.height).toBeGreaterThan(200);
  });
});

describe("renderLineageSvg", () => {
  it("returns empty string for empty layout", () => {
    expect(renderLineageSvg({ width: 0, height: 0, nodes: [], edges: [] })).toBe("");
  });

  it("contains a rect for each node and a path for each edge", () => {
    const layout = layoutLineage(
      [person("a", "A"), person("b", "B")],
      [edge("a", "b")],
    );
    const svg = renderLineageSvg(layout);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg.match(/<rect/g)?.length).toBe(2);
    expect(svg.match(/<path/g)?.length).toBeGreaterThanOrEqual(1);
    // 1 edge path + 5 marker paths in <defs>
    expect(svg).toContain("marker-end");
  });

  it("escapes XML special characters in labels (XSS guard)", () => {
    const layout = layoutLineage([person("a", "<script>alert(1)</script>")], []);
    const svg = renderLineageSvg(layout);
    expect(svg).not.toContain("<script>alert(1)</script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("uses a different fill per node kind", () => {
    const layout = layoutLineage(
      [
        { id: "p", label: "Person", kind: "person" },
        { id: "e", label: "Entity", kind: "entity" },
        { id: "u", label: "Unknown", kind: "unknown" },
      ],
      [],
    );
    const svg = renderLineageSvg(layout);
    expect(svg).toContain("#eef2ff"); // person
    expect(svg).toContain("#fff7ed"); // entity
    expect(svg).toContain("#f5f5f5"); // unknown
  });

  it("truncates very long labels", () => {
    const longLabel = "A".repeat(200);
    const layout = layoutLineage([person("a", longLabel)], []);
    const svg = renderLineageSvg(layout);
    // The label text element should not contain the full 200-char string
    expect(svg).not.toContain(longLabel);
    expect(svg).toContain("…");
  });

  it("uses dashed stroke for mortgage relationships", () => {
    const layout = layoutLineage(
      [person("a", "Owner"), person("b", "Bank")],
      [edge("a", "b", "mortgaged_to")],
    );
    const svg = renderLineageSvg(layout);
    expect(svg).toMatch(/stroke-dasharray[^"]*4[^"]*2/);
  });
});

describe("renderLineageTimeline", () => {
  it("returns empty string for empty layout", () => {
    expect(renderLineageTimeline({ width: 0, height: 0, nodes: [], edges: [] })).toBe("");
  });

  it("renders one <li> per node", () => {
    const layout = layoutLineage(
      [person("a", "A"), person("b", "B"), person("c", "C")],
      [edge("a", "b"), edge("b", "c")],
    );
    const html = renderLineageTimeline(layout);
    expect((html.match(/<li/g) ?? []).length).toBe(3);
  });

  it("escapes special characters in node labels", () => {
    const layout = layoutLineage([person("a", "<img onerror=x>")], []);
    const html = renderLineageTimeline(layout);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});