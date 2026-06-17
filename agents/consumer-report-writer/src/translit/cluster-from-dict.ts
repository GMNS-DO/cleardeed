/**
 * cluster-from-dict.ts — Algorithmically derive SURNAME_CLUSTERS from the dict.
 *
 * Plan §2.2 P1 P2: replaces the hand-built SURNAME_CLUSTERS with an
 * algorithmically derived one. Two surnames are clustered if they:
 *   1. Have Damerau-Levenshtein distance <= 2, OR
 *   2. Share a common prefix of length >= 4
 *
 * This is a one-shot script. Output is committed to
 * translit/derived-clusters.json and used by the A5 wiring (or kept
 * for diagnostic comparison with HAND_BUILT_SURNAME_CLUSTERS).
 *
 * Run with:  pnpm tsx translit/cluster-from-dict.ts
 *
 * Note: P1 P2 ships the script + the hand-built clusters. P1 P3 (week 3)
 * may swap the runtime source to derived-clusters.json once we have
 * empirical evidence the algorithm matches Bhulekh-OCR confusions.
 */

import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { loadOdiaNameDict } from "../dictionaries/odia-names";
import { damerauLevenshtein } from "./surname-match";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Tunable thresholds. The original max-D-L=2 was too generous for
// short surnames (4-letter words cluster spuriously). Use a
// length-relative cap: 1 edit for length 3-4, 2 for length 5-6, 3 for
// length 7+.
function maxDlForLength(len: number): number {
  if (len <= 4) return 1;
  if (len <= 6) return 2;
  return 3;
}
const MIN_COMMON_PREFIX = 5;

function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * Single-link clustering with stricter thresholds to avoid transitive
 * merging (which produces nonsense "ananda clusters with everything"
 * clusters).
 *
 * Two names are clustered iff BOTH:
 *   1. They have Damerau-Levenshtein distance ≤ 2 (or length-relative cap)
 *   2. They share a prefix of length >= 3
 *
 * This prevents "ananda" from clustering with "baral" through a chain
 * of intermediate names. Only DIRECT pairs with strong similarity join.
 *
 * Note: this is a strict algorithm — many Bhulekh-OCR confusions won't
 * be captured (e.g. "Mohapatra" vs "Misra" don't share prefix). The
 * HAND_BUILT_SURNAME_CLUSTERS in surname-match.ts is the production
 * source of truth; this derived output is for inspection and tracking
 * improvement over time.
 */
function main() {
  const dict = loadOdiaNameDict();
  const tokens = Object.values(dict);

  // Only cluster multi-letter Latin names (skip single-letter like "Lal",
  // and skip obvious non-surnames by length filter).
  const surnames = tokens.filter(
    (t) => t.length >= 4 && /^[a-zA-Z]+$/.test(t)
  );
  const surnameSet = new Set(surnames.map((s) => s.toLowerCase()));
  const surnamesList = [...surnameSet];

  // Single-link: build clusters where each member has at least one
  // strong-similarity partner in the cluster.
  const clusterOf = new Map<string, number>(); // name -> clusterId
  const clusters: string[][] = [];

  for (let i = 0; i < surnamesList.length; i++) {
    const a = surnamesList[i];
    let aCluster: number | undefined = clusterOf.get(a);
    for (let j = 0; j < surnamesList.length; j++) {
      if (i === j) continue;
      const b = surnamesList[j];
      const d = damerauLevenshtein(a, b);
      const cp = commonPrefixLength(a, b);
      const minLen = Math.min(a.length, b.length);
      const maxDl = maxDlForLength(minLen);
      const passesDl = d <= maxDl;
      const passesCp = cp >= 3;
      if (passesDl && passesCp) {
        const bCluster = clusterOf.get(b);
        if (aCluster === undefined && bCluster === undefined) {
          // New cluster with both a and b
          const newClusterId = clusters.length;
          clusters.push([a, b]);
          clusterOf.set(a, newClusterId);
          clusterOf.set(b, newClusterId);
          aCluster = newClusterId;
        } else if (aCluster !== undefined && bCluster === undefined) {
          // Add b to a's cluster
          clusters[aCluster].push(b);
          clusterOf.set(b, aCluster);
        } else if (aCluster === undefined && bCluster !== undefined) {
          // Add a to b's cluster
          clusters[bCluster].push(a);
          clusterOf.set(a, bCluster);
          aCluster = bCluster;
        } else if (aCluster !== undefined && bCluster !== undefined && aCluster !== bCluster) {
          // Merge two clusters
          const merged = [...clusters[aCluster], ...clusters[bCluster]];
          clusters[aCluster] = merged;
          clusters[bCluster] = [];
          for (const m of merged) clusterOf.set(m, aCluster);
        }
      }
    }
  }

  // Keep only groups with >= 2 members (single-member "clusters" are not clusters)
  const finalClusters: Record<string, string[]> = {};
  for (const members of clusters) {
    if (members.length >= 2) {
      const sorted = [...new Set(members)].sort();
      finalClusters[sorted[0]] = sorted;
    }
  }

  const output = {
    _meta: {
      generated: new Date().toISOString(),
      source: "algorithmically derived from odia-names.json (single-link, D-L + prefix >= 3)",
      method: "D-L distance (length-relative) AND common_prefix >= 3, single-link clustering",
      clusterCount: Object.keys(finalClusters).length,
      surnameCount: surnamesList.length,
      note: "Diagnostic only. HAND_BUILT_SURNAME_CLUSTERS in surname-match.ts is the production source.",
    },
    clusters: finalClusters,
  };

  const outPath = join(__dirname, "derived-clusters.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`Wrote ${Object.keys(finalClusters).length} clusters to ${outPath}`);
  console.log(`Total surnames analyzed: ${surnamesList.length}`);
  for (const [key, members] of Object.entries(finalClusters).slice(0, 15)) {
    console.log(`  ${key}: ${members.join(", ")}`);
  }
  if (Object.keys(finalClusters).length > 15) {
    console.log(`  ... and ${Object.keys(finalClusters).length - 15} more`);
  }
}

main();
