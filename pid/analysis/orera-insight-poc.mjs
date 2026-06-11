#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const DEFAULT_RUN = "2026-05-26-orera-50";
const DEFAULT_ROOT = "pid/data/raw/orera";
const DEFAULT_OUT_DIR = "pid/research/generated";

function parseArgs(argv) {
  const options = {
    run: DEFAULT_RUN,
    root: DEFAULT_ROOT,
    outDir: DEFAULT_OUT_DIR,
  };

  for (const arg of argv) {
    if (arg.startsWith("--run=")) options.run = arg.slice("--run=".length);
    else if (arg.startsWith("--root=")) options.root = arg.slice("--root=".length);
    else if (arg.startsWith("--out-dir=")) options.outDir = arg.slice("--out-dir=".length);
  }

  return options;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readOptionalJson(path) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function resultOf(decodedArtifact) {
  return decodedArtifact?.decoded?.result ?? null;
}

function hasPositiveId(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return value > 0;
  const text = String(value).trim();
  return text !== "" && text !== "0" && text.toLowerCase() !== "null";
}

function yes(value) {
  return String(value ?? "").trim().toLowerCase() === "yes" || value === 1 || value === true;
}

function no(value) {
  return String(value ?? "").trim().toLowerCase() === "no" || value === 0 || value === false;
}

function parsePercent(value) {
  if (value === null || value === undefined) return null;
  const match = String(value).match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function sumOwnerShares(owners) {
  const shares = asArray(owners).map((owner) => parsePercent(owner.share)).filter((value) => Number.isFinite(value));
  if (!shares.length) return null;
  return Number(shares.reduce((sum, value) => sum + value, 0).toFixed(2));
}

function titleFlowSignals(titleFlow) {
  const text = String(titleFlow ?? "").toLowerCase();
  const matches = [];
  const rules = [
    ["development_agreement", /\bdevelopment agreement\b/],
    ["poa", /\bpoa\b|power of attorney/],
    ["derived_sub_plot", /derived|sub-?plot/],
    ["gifted_for_road", /gift|road/],
    ["authority_mutation_or_subdivision", /tahasildar|tahasil|mutation|settlement/],
    ["area_change", /decimal|sq\.?\s*m|square|area/],
  ];

  for (const [id, pattern] of rules) {
    if (pattern.test(text)) matches.push(id);
  }

  return matches;
}

function evidenceRef(projectId, document, run) {
  if (!document?.file_id) return null;
  return {
    file_id: String(document.file_id),
    field: document.field,
    file_path: `pid/data/raw/orera/${run}/artifacts/project-${projectId}-doc-${document.file_id}-${String(document.field).toLowerCase()}.pdf`,
  };
}

function evidenceForFieldId(projectSummary, documentsByField, field, fileId, run) {
  if (!hasPositiveId(fileId)) return [];
  const wanted = String(fileId);
  return asArray(documentsByField[field])
    .filter((document) => String(document.file_id) === wanted)
    .map((document) => evidenceRef(projectSummary.projectId, document, run))
    .filter(Boolean);
}

function projectDocumentsByField(projectSummary) {
  const grouped = {};
  for (const document of asArray(projectSummary.documents)) {
    grouped[document.field] ??= [];
    grouped[document.field].push(document);
  }
  return grouped;
}

function addSignal(signals, signal) {
  signals.push({
    evidence_level: "E1",
    buyer_impact: "review",
    ...signal,
  });
}

function buildPlotSignals({ projectSummary, overview, landRow, landIndex, run }) {
  const signals = [];
  const documentsByField = projectDocumentsByField(projectSummary);
  const plotEcPresent = hasPositiveId(landRow.plotEcId);
  const plotRorPresent = hasPositiveId(landRow.plotRorId);
  const poaPresent = hasPositiveId(landRow.poaId) || yes(landRow.powerAttorney) || landRow.isPOA === 1;
  const saleDeedPresent = hasPositiveId(landRow.saleDeedId) || yes(landRow.saleDeed) || landRow.isSaleDeed === 1;
  const shareAllocPresent = hasPositiveId(landRow.shareAllocId);
  const ownerShareSum = sumOwnerShares(landRow.owners);
  const flowSignals = titleFlowSignals(landRow.titleFlow);
  const plotEcRefs = evidenceForFieldId(projectSummary, documentsByField, "plotEcId", landRow.plotEcId, run);
  const plotRorRefs = evidenceForFieldId(projectSummary, documentsByField, "plotRorId", landRow.plotRorId, run);
  const poaRefs = evidenceForFieldId(projectSummary, documentsByField, "poaId", landRow.poaId, run);

  if (plotEcPresent) {
    addSignal(signals, {
      signal_id: plotEcRefs.length ? "ORERA_PLOT_EC_ARTIFACT_COLLECTED" : "ORERA_PLOT_EC_DECLARED_NOT_COLLECTED",
      pattern_family: "evidence_available",
      title: plotEcRefs.length ? "Plot EC PDF was collected" : "Plot EC file ID is declared but PDF was not collected in this capped run",
      why_it_matters: plotEcRefs.length
        ? "The plot has an ORERA-linked encumbrance-certificate artifact that can be OCR/reviewed for transaction chain, charge, or repeated-sale signals."
        : "ORERA declares an EC file ID for this plot row; a later uncapped/resume run should fetch the PDF before content-level review.",
      evidence_refs: plotEcRefs.length ? plotEcRefs : [`project-${projectSummary.projectId}-land-details_decoded.json`],
      buyer_match_fields: ["plotNo", "khataNo", "mouza", "projectName", "promoterName"],
      confidence: plotEcRefs.length ? "metadata_high_content_pending" : "metadata_medium_fetch_pending",
    });
  } else {
    addSignal(signals, {
      signal_id: "ORERA_MISSING_PLOT_EC",
      pattern_family: "document_gap",
      title: "No plot EC document declared in this ORERA land row",
      why_it_matters: "For buyer matching, absence of EC evidence means chain/encumbrance review cannot be completed from this ORERA bundle alone.",
      evidence_refs: [`project-${projectSummary.projectId}-land-details_decoded.json`],
      buyer_match_fields: ["plotNo", "khataNo", "mouza"],
      confidence: "metadata_medium",
    });
  }

  if (plotRorPresent) {
    addSignal(signals, {
      signal_id: plotRorRefs.length ? "ORERA_PLOT_ROR_ARTIFACT_COLLECTED" : "ORERA_PLOT_ROR_DECLARED_NOT_COLLECTED",
      pattern_family: "evidence_available",
      title: plotRorRefs.length ? "Plot RoR PDF was collected" : "Plot RoR file ID is declared but PDF was not collected in this capped run",
      why_it_matters: plotRorRefs.length
        ? "The plot has an ORERA-linked RoR artifact that can be OCR/reviewed for owner, kisam, share, and remarks signals."
        : "ORERA declares a RoR file ID for this plot row; a later uncapped/resume run should fetch the PDF before content-level review.",
      evidence_refs: plotRorRefs.length ? plotRorRefs : [`project-${projectSummary.projectId}-land-details_decoded.json`],
      buyer_match_fields: ["plotNo", "khataNo", "mouza", "ownerName"],
      confidence: plotRorRefs.length ? "metadata_high_content_pending" : "metadata_medium_fetch_pending",
    });
  } else {
    addSignal(signals, {
      signal_id: "ORERA_MISSING_PLOT_ROR",
      pattern_family: "document_gap",
      title: "No plot RoR document declared in this ORERA land row",
      why_it_matters: "RoR owner/classification checks cannot be completed from this ORERA bundle alone; buyer-provided RoR becomes mandatory.",
      evidence_refs: [`project-${projectSummary.projectId}-land-details_decoded.json`],
      buyer_match_fields: ["plotNo", "khataNo", "mouza"],
      confidence: "metadata_medium",
    });
  }

  if (poaPresent) {
    addSignal(signals, {
      signal_id: saleDeedPresent ? "ORERA_POA_CHAIN_PRESENT" : "ORERA_POA_WITHOUT_DECLARED_SALE_DEED",
      pattern_family: "title_authority",
      title: saleDeedPresent ? "POA-based title chain present" : "POA-based chain with no sale deed declared in land row",
      why_it_matters: saleDeedPresent
        ? "POA is not a defect by itself, but buyer matching should verify authority scope, executant, holder, dates, and sale deed linkage."
        : "POA is not a defect by itself, but absence of declared sale deed metadata increases the need to verify authority, development agreement, and transfer chain.",
      evidence_refs: poaRefs.length
        ? poaRefs
        : [`project-${projectSummary.projectId}-land-details_decoded.json`],
      buyer_match_fields: ["sellerName", "ownerName", "poaHolderName", "poaRegnNo", "plotNo", "khataNo"],
      confidence: saleDeedPresent ? "metadata_medium" : "metadata_high_review_required",
    });
  }

  if (flowSignals.length >= 2) {
    addSignal(signals, {
      signal_id: "ORERA_COMPLEX_TITLE_FLOW",
      pattern_family: "title_chain_complexity",
      title: "Title flow contains subdivision/gift/development-agreement complexity",
      why_it_matters: "Buyer matching should compare old plot, derived plot, gifted/road area, and development agreement facts against RoR, EC, and sale documents.",
      evidence_refs: [`project-${projectSummary.projectId}-land-details_decoded.json`],
      buyer_match_fields: ["plotNo", "oldPlotNo", "khataNo", "mouza", "titleFlowText"],
      confidence: "metadata_medium_review_required",
      matched_terms: flowSignals,
    });
  }

  if (ownerShareSum !== null && ownerShareSum < 99) {
    addSignal(signals, {
      signal_id: "ORERA_PARTIAL_OWNER_SHARE_DECLARED",
      pattern_family: "ownership_share",
      title: "Declared owner shares do not add up to full ownership",
      why_it_matters: "This may be normal for a project land contribution, but for buyer matching it is a strong prompt to verify whether all co-owners/shareholders joined the transaction.",
      evidence_refs: [`project-${projectSummary.projectId}-land-details_decoded.json`],
      buyer_match_fields: ["ownerName", "sellerName", "khataNo", "plotNo"],
      confidence: "metadata_medium_review_required",
      owner_share_sum: ownerShareSum,
    });
  }

  if (!saleDeedPresent && poaPresent) {
    addSignal(signals, {
      signal_id: "ORERA_SALE_DEED_GAP_WITH_POA",
      pattern_family: "document_gap",
      title: "POA exists but sale deed is not declared",
      why_it_matters: "The buyer should confirm whether the sale/transfer authority is backed by a registered conveyance or only by development authority documents.",
      evidence_refs: [`project-${projectSummary.projectId}-land-details_decoded.json`],
      buyer_match_fields: ["poaRegnNo", "plotNo", "khataNo", "mouza"],
      confidence: "metadata_high_review_required",
    });
  } else if (!saleDeedPresent) {
    addSignal(signals, {
      signal_id: "ORERA_SALE_DEED_NOT_DECLARED",
      pattern_family: "document_gap",
      title: "Sale deed is not declared in this land row",
      why_it_matters: "This is not proof of a defect, but buyer matching should require the buyer/seller sale deed or chain document before treating title transfer as verified.",
      evidence_refs: [`project-${projectSummary.projectId}-land-details_decoded.json`],
      buyer_match_fields: ["plotNo", "khataNo", "mouza"],
      confidence: "metadata_medium",
    });
  }

  return {
    plot_index: landIndex,
    identifiers: {
      project_id: projectSummary.projectId,
      project_name: projectSummary.projectName,
      promoter_name: projectSummary.promoterName,
      registration_no: projectSummary.registrationNo,
      district_code: projectSummary.district,
      district_name: overview?.projectDistName ?? null,
      tahasil_name: overview?.projectTahasilName ?? null,
      mouza: landRow.mouza ?? null,
      khata_no: landRow.khataNo ?? null,
      plot_no: landRow.plotNo ?? null,
      kisam: landRow.kisamaName ?? landRow.kisama ?? null,
    },
    declared_facts: {
      plot_area: landRow.plotArea ?? null,
      plot_area_unit: landRow.plotAreaUnit ?? null,
      plot_area_included: landRow.plotAreaIncuded ?? null,
      power_attorney: landRow.powerAttorney ?? null,
      sale_deed: landRow.saleDeed ?? null,
      encumbrance: landRow.encumbrance ?? null,
      plot_occupied: landRow.plotOccupied ?? null,
      poa_regn_no: landRow.poaRegnNo ?? null,
      poa_regn_date: landRow.poaRegnDate ?? null,
      poa_regn_at: landRow.poaRegnAt ?? null,
      title_flow: landRow.titleFlow ?? null,
      owners: asArray(landRow.owners).map((owner) => ({
        name: owner.name ?? null,
        share: owner.share ?? null,
        file_id: owner.fileId ?? null,
      })),
    },
    evidence_status: {
      plot_ec: plotEcPresent,
      plot_ror: plotRorPresent,
      poa: poaPresent,
      sale_deed: saleDeedPresent,
      share_allocation: shareAllocPresent,
    },
    candidate_signals: signals,
  };
}

function markdownFor(output) {
  const topSignals = Object.entries(output.summary.signal_counts)
    .sort((a, b) => b[1] - a[1])
    .map(([signal, count]) => `| ${signal} | ${count} |`)
    .join("\n");

  const samples = output.sample_cards.map((card) => {
    const lines = [
      `### ${card.identifiers.project_name} / ${card.identifiers.plot_no}`,
      "",
      `- Project: ${card.identifiers.project_id} (${card.identifiers.registration_no})`,
      `- Mouza/khata/plot: ${card.identifiers.mouza || "-"} / ${card.identifiers.khata_no || "-"} / ${card.identifiers.plot_no || "-"}`,
      `- Promoter: ${card.identifiers.promoter_name || "-"}`,
      `- Evidence status: EC=${card.evidence_status.plot_ec}, RoR=${card.evidence_status.plot_ror}, POA=${card.evidence_status.poa}, Sale deed=${card.evidence_status.sale_deed}`,
      "",
      "| Candidate signal | Why it matters | Confidence |",
      "|---|---|---|",
      ...card.candidate_signals.slice(0, 5).map((signal) => `| ${signal.signal_id} | ${signal.why_it_matters.replaceAll("|", "/")} | ${signal.confidence} |`),
    ];
    return lines.join("\n");
  }).join("\n\n");

  return `# ORERA 50-Project Insight POC Candidates

Generated from \`${output.source.run_folder}\`.

This file is an inspectable POC output, not a legal conclusion. Signals are metadata-level candidates until the linked PDFs are OCR/text-extracted and reviewed.

## Summary

| Metric | Count |
|---|---:|
| Projects | ${output.summary.project_count} |
| Plot rows | ${output.summary.plot_row_count} |
| Candidate cards | ${output.summary.candidate_card_count} |
| Candidate signals | ${output.summary.total_signal_count} |

## Signal Counts

| Signal | Count |
|---|---:|
${topSignals}

## Sample Cards

${samples}
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runFolder = join(options.root, options.run);
  const extractedFolder = join(runFolder, "extracted");
  const summary = await readJson(join(extractedFolder, "project_detail_sample_summary.json"));
  const cards = [];
  const signalCounts = {};

  for (const projectSummary of asArray(summary.projects)) {
    const projectId = projectSummary.projectId;
    const overviewArtifact = await readOptionalJson(join(extractedFolder, `project-${projectId}-overview_decoded.json`));
    const landArtifact = await readOptionalJson(join(extractedFolder, `project-${projectId}-land-details_decoded.json`));
    const overview = resultOf(overviewArtifact) ?? {};
    const landRows = asArray(resultOf(landArtifact));

    landRows.forEach((landRow, index) => {
      const card = buildPlotSignals({ projectSummary, overview, landRow, landIndex: index, run: options.run });
      cards.push(card);
      for (const signal of card.candidate_signals) {
        signalCounts[signal.signal_id] = (signalCounts[signal.signal_id] ?? 0) + 1;
      }
    });
  }

  const output = {
    generated_at: new Date().toISOString(),
    source: {
      run: options.run,
      run_folder: runFolder,
      project_summary: join(extractedFolder, "project_detail_sample_summary.json"),
    },
    purpose: "First-pass metadata-level candidate signals for plot-buyer risk pattern synthesis. Not legal advice and not human reviewed.",
    summary: {
      project_count: asArray(summary.projects).length,
      plot_row_count: cards.length,
      candidate_card_count: cards.length,
      total_signal_count: cards.reduce((sum, card) => sum + card.candidate_signals.length, 0),
      signal_counts: signalCounts,
    },
    buyer_matching_fields: [
      "district_name",
      "tahasil_name",
      "mouza",
      "khata_no",
      "plot_no",
      "owner_name",
      "seller_name",
      "promoter_name",
      "project_name",
      "registration_no",
      "poa_regn_no",
      "ec_parties",
      "ror_owner_rows",
    ],
    candidate_cards: cards,
    sample_cards: cards.slice(0, 8),
  };

  await mkdir(options.outDir, { recursive: true });
  const jsonPath = join(options.outDir, `orera_50_pattern_candidates.json`);
  const mdPath = join(options.outDir, `orera_50_pattern_candidates.md`);
  await writeFile(jsonPath, JSON.stringify(output, null, 2));
  await writeFile(mdPath, markdownFor(output));

  console.log(JSON.stringify({
    json: jsonPath,
    markdown: mdPath,
    source: basename(runFolder),
    ...output.summary,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
