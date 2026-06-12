#!/usr/bin/env node

/**
 * Generates qa/ground_truth/_corpus_coverage.md
 * Matrix: 10 tahasils × plot patterns × BDA zones × kisam classes
 * Reads P001-P050 directory names per the V2 contract helper.
 *
 * Run from project root: node qa/scripts/coverage_matrix.mjs
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const SCRIPT_DIR = new URL('.', import.meta.url).pathname;
const GT_DIR = join(SCRIPT_DIR, '..', 'ground_truth');

const TAHASILS = [
  "Bhubaneswar", "Kordha", "Jatni", "Tangi", "Banapur",
  "Balianta", "Balipatna", "Begunia", "Bolgarh", "Chilika"
];

const PLOT_PATTERNS = ["numeric", "d_prefix", "fraction", "alphanumeric"];
const BDA_ZONES = ["residential", "commercial", "industrial", "mixed_use", "green_belt", "special", "institutional", "agricultural"];
const KISAM_CLASSES = ["residential", "agricultural", "industrial", "commercial"];

const plotDirs = readdirSync(GT_DIR)
  .filter(d => /^P\d{3}$/.test(d))
  .sort();

const plots = plotDirs.map(d => {
  const manifestPath = join(GT_DIR, d, 'manifest.json');
  try {
    const m = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    return { dir: d, ...m.coverage, verified: m.verified_by === 'founder' };
  } catch (e) {
    return null;
  }
}).filter(Boolean);

const total = plots.length;
const verified = plots.filter(p => p.verified).length;
const pending = total - verified;

let md = `# Ground-Truth Corpus Coverage Matrix

> Generated: ${new Date().toISOString().slice(0, 10)}
> Total plots: ${total} | Verified: ${verified} | Pending: ${pending}

This matrix shows the 50-plot ground-truth corpus coverage of the 10-tahasil Khordha
space, sliced by plot pattern, BDA zone, and kisam class. **Empty cells are gaps** the
founder must fill in subsequent manual-verification sessions.

---

## Coverage by Tahasil × Plot Pattern

| Tahasil \\ Pattern | numeric | d_prefix | fraction | alphanumeric | Total |
|---|---|---|---|---|---|
`;

for (const tahasil of TAHASILS) {
  const counts = PLOT_PATTERNS.map(p => plots.filter(x => x.tahasil === tahasil && x.pattern_category === p).length);
  const rowTotal = counts.reduce((a, b) => a + b, 0);
  md += `| **${tahasil}** | ${counts.map(c => c || '·').join(' | ')} | **${rowTotal}** |\n`;
}

md += `
---

## Coverage by BDA Zone × Kisam Class

| BDA Zone \\ Kisam | residential | agricultural | industrial | commercial | Total |
|---|---|---|---|---|---|
`;

for (const zone of BDA_ZONES) {
  const counts = KISAM_CLASSES.map(k => plots.filter(x => x.bda_zone === zone && x.kisam_class === k).length);
  const rowTotal = counts.reduce((a, b) => a + b, 0);
  if (rowTotal === 0) continue;
  md += `| **${zone}** | ${counts.map(c => c || '·').join(' | ')} | **${rowTotal}** |\n`;
}

md += `
---

## Coverage by Tahasil × BDA Zone

| Tahasil \\ BDA | ${BDA_ZONES.join(' | ')} | Total |
|---|---|---|
`;

for (const tahasil of TAHASILS) {
  const counts = BDA_ZONES.map(z => plots.filter(x => x.tahasil === tahasil && x.bda_zone === z).length);
  const rowTotal = counts.reduce((a, b) => a + b, 0);
  md += `| **${tahasil}** | ${counts.map(c => c || '·').join(' | ')} | **${rowTotal}** |\n`;
}

md += `
---

## Verified Plots (${verified})

| Plot ID | Tahasil | Village | Plot # | Pattern | Verified |
|---|---|---|---|---|---|
`;

const verifiedPlots = plots.filter(p => p.verified);
for (const p of verifiedPlots) {
  md += `| ${p.dir} | ${p.tahasil} | ${p.village} | ${p.plot_no} | ${p.pattern_category} | yes |\n`;
}

md += `
---

## Pending Scaffolds (${pending})

Plots P006–P050 are empty scaffolds awaiting manual verification. Each has a
\`transcript.md\` with the manual steps and a \`manifest.json\` with
\`fetchers: { bhulekh: null, ... }\` (the founder fills in the contract envelopes).

The first 5 empty plots to verify (highest value):

`;

const pendingByP = plots.filter(p => !p.verified).slice(0, 5);
for (const p of pendingByP) {
  md += `- \`${p.dir}\` — ${p.tahasil}/${p.village} (${p.pattern_category}, ${p.bda_zone}, ${p.kisam_class})\n`;
}

writeFileSync(join(GT_DIR, '_corpus_coverage.md'), md);
console.log(`✓ Wrote coverage matrix: ${total} plots, ${verified} verified, ${pending} pending`);
