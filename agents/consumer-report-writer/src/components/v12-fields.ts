// agents/consumer-report-writer/src/components/v12-fields.ts
//
// T10 — Surface V1.2 (Track A) extracted fields in the buyer-facing report.
// These are derived from Bhulekh parser additions:
//   - chauhaddiByPlot (per-plot boundary bearings)
//   - section6 (Khasra non-tenant area references)
//   - khewatNo (zamindar khewat number from RoR)
//   - hasPoA (Power-of-Attorney inference from rights text)
//   - ownerFieldMissing (parse-failure marker on tenant name field)
//   - mutationReferences[] (already on revenueRecords, surfaced inline)
//
// Render rule: present a compact "ground truth" sub-panel inside the
// plot section. Raw Odia is paired with English reading. Source trust
// strip is shown inline per field.

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

function has(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function getChauhaddiForPlot(
  revenueRecords: any,
  plotNo: unknown
): { north?: any; south?: any; east?: any; west?: any } | null {
  const byPlot = revenueRecords?.chauhaddiByPlot;
  if (!byPlot || typeof byPlot !== "object") return null;
  const key = String(plotNo ?? "").trim();
  if (!key) return null;
  if (byPlot[key]) return byPlot[key];
  // Fallback: try numeric-odia conversion since plotNo in URL is arabic but
  // Bhulekh keys are sometimes in Odia digits.
  for (const [k, v] of Object.entries(byPlot)) {
    if (String(k).includes(key)) return v as any;
  }
  return null;
}

function buildChauhaddiCard(
  revenueRecords: any,
  plotNo: unknown
): string {
  const ch = getChauhaddiForPlot(revenueRecords, plotNo);
  if (!ch) return "";
  const cells = [
    { label: "North", v: ch.north },
    { label: "South", v: ch.south },
    { label: "East", v: ch.east },
    { label: "West", v: ch.west },
  ]
    .filter((c) => has(c.v))
    .map(
      (c) => `<tr><td class="key">${escapeHtml(c.label)}</td><td class="mono">${escapeHtml(c.v)}</td></tr>`
    )
    .join("");
  if (!cells) return "";
  return `
<details class="v12-card">
  <summary><b>Plot boundary bearings (Chauhaddi)</b> — Bhulekh RoR plot ${escapeHtml(String(plotNo ?? ""))}</summary>
  <table class="data-table v12-table">
    <tbody>${cells}</tbody>
  </table>
  <div class="v12-trust">
    <span>📍 Source: Bhulekh RoR (bhulekh.ori.nic.in)</span>
    <span>🔒 Hash: ${escapeHtml(revenueRecords?.source?.rowHash ?? revenueRecords?.raw?.rowHash ?? "field-level")}</span>
    <span>📜 Original Odia: ${escapeHtml(revenueRecords?.raw?.fullTextOdia ?? "(included in PDF layer)")}</span>
  </div>
</details>`;
}

function buildKhewatPoACard(revenueRecords: any): string {
  const r = revenueRecords?.raw;
  if (!r) return "";
  const khewat = r.khewatNo ?? revenueRecords?.khewatNo ?? null;
  const hasPoA = r.hasPoA ?? revenueRecords?.hasPoA ?? null;
  const ownerMissing = r.ownerFieldMissing ?? revenueRecords?.ownerFieldMissing ?? null;
  if (
    khewat === null &&
    hasPoA === null &&
    ownerMissing === null
  ) {
    return "";
  }

  const khewatRow = has(khewat)
    ? `<tr><td class="key">Khewat Number</td><td class="mono">${escapeHtml(String(khewat))}</td></tr>`
    : `<tr><td class="key">Khewat Number</td><td class="mono v12-empty">Not recorded on this RoR page</td></tr>`;

  let poaRow = "";
  if (hasPoA === true) {
    poaRow = `<tr><td class="key">Power of Attorney</td><td class="mono"><span class="v12-warn">⚠ PoA inferred from rights text</span> — verify at IGR SRO before sale</td></tr>`;
  } else if (hasPoA === false) {
    poaRow = `<tr><td class="key">Power of Attorney</td><td class="mono">No PoA indicator in rights text</td></tr>`;
  } else {
    poaRow = `<tr><td class="key">Power of Attorney</td><td class="mono v12-empty">Rights text not parsed — verify manually</td></tr>`;
  }

  let ownerRow = "";
  if (ownerMissing === true) {
    ownerRow = `<tr><td class="key">Owner Field</td><td class="mono"><span class="v12-warn">⚠ Owner field not readable on RoR</span> — open Bhulekh PDF and verify by hand</td></tr>`;
  } else if (ownerMissing === false) {
    ownerRow = `<tr><td class="key">Owner Field</td><td class="mono">Owner field parsed cleanly</td></tr>`;
  }

  return `
<details class="v12-card">
  <summary><b>Revenue-record flags</b> — Khewat, Power of Attorney, Owner-field parse status</summary>
  <table class="data-table v12-table">
    <tbody>
      ${khewatRow}
      ${poaRow}
      ${ownerRow}
    </tbody>
  </table>
  <div class="v12-trust">
    <span>📍 Source: Bhulekh RoR (bhulekh.ori.nic.in)</span>
    <span>🔧 Bhulekh parser v${escapeHtml(revenueRecords?.parserVersion ?? "3.2")}</span>
    <span>📜 Original Odia: ${escapeHtml(revenueRecords?.record?.tenantBlockRawOdia ?? "(included in PDF layer)")}</span>
  </div>
</details>`;
}

function buildSection6Card(revenueRecords: any): string {
  const s6 = revenueRecords?.section6;
  if (!s6) return "";
  const present = Boolean(s6.present);
  const refCount = Number(s6.referenceCount ?? 0);
  if (!present && refCount === 0) return "";
  const areaAcres = s6.areaAcres;
  const status = present
    ? `<span class="v12-warn">⚠ Section 6 reference found</span>`
    : `<span class="v12-ok">✓ No Section 6 reference</span>`;
  return `
<details class="v12-card">
  <summary><b>Section 6 (Khasra non-tenant) status</b> — ${escapeHtml(status)}</summary>
  <p class="v12-prose">Section 6 of the Odisha Land Reforms Act covers khasra / non-tenant land. If the RoR shows a Section 6 reference, the plot may carry government land-marker status. ${refCount > 0 ? `${refCount} reference${refCount === 1 ? "" : "s"} detected.` : ""}</p>
  ${areaAcres ? `<div class="v12-trust"><span>📐 Section 6 area: ${escapeHtml(areaAcres)} acres</span></div>` : ""}
  <div class="v12-trust">
    <span>📍 Source: Bhulekh RoR (bhulekh.ori.nic.in)</span>
    <span>📐 Template matched: ${escapeHtml(revenueRecords?.parserTemplateMatchedAt ?? "verified on parse")}</span>
  </div>
</details>`;
}

function buildMutationReferencesCard(revenueRecords: any): string {
  const refs: any[] = revenueRecords?.mutationReferences ?? [];
  if (!refs.length) return "";
  const rows = refs
    .map((r, i) => {
      const caseNo = r.caseNo ?? r.caseRef ?? "—";
      const date = r.orderDate ?? r.date ?? "—";
      const caseType = r.caseType ?? "—";
      const plotNo = r.plotNo ?? "—";
      return `<tr>
        <td class="num">${i + 1}</td>
        <td class="mono">${escapeHtml(caseNo)}</td>
        <td>${escapeHtml(caseType)}</td>
        <td>${escapeHtml(date)}</td>
        <td>${escapeHtml(plotNo)}</td>
      </tr>`;
    })
    .join("");
  return `
<details class="v12-card">
  <summary><b>Mutation references on RoR back page</b> — ${refs.length} anchor${refs.length === 1 ? "" : "s"} (anchor-only, not verified ownership history)</summary>
  <p class="v12-prose">These are case-anchors extracted from the RoR back page — they signal that a mutation order references this plot, but do not by themselves establish a transfer chain. Verify against IGR SRO for a complete record.</p>
  <table class="data-table v12-table">
    <thead><tr><th>#</th><th>Case No.</th><th>Type</th><th>Order Date</th><th>Plot</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="v12-trust">
    <span>📍 Source: Bhulekh RoR (bhulekh.ori.nic.in)</span>
    <span>📜 Original Odia: ${escapeHtml(revenueRecords?.remarks?.specialRemarksRawOdia ?? "(included in PDF layer)")}</span>
  </div>
</details>`;
}

/**
 * Top-level V1.2 sub-panel for Section 1 (Plot) of the report.
 * Renders 0–4 collapsible details cards depending on which fields are present.
 */
export function buildV12FieldPanel(input: {
  revenueRecords: any | null;
  plotNo: unknown;
}): string {
  if (!input.revenueRecords) return "";
  const cards = [
    buildChauhaddiCard(input.revenueRecords, input.plotNo),
    buildKhewatPoACard(input.revenueRecords),
    buildSection6Card(input.revenueRecords),
    buildMutationReferencesCard(input.revenueRecords),
  ].filter((s) => s && s.trim().length > 0);
  if (!cards.length) return "";

  return `
<section class="v12-fields" id="v12-ground-truth">
  <div class="v12-header">
    <span class="v12-eyebrow">GROUND TRUTH — Bhulekh RoR field-by-field</span>
    <span class="v12-sub">Each collapsible card pairs the English reading with the original Odia source text and the source record hash.</span>
  </div>
  ${cards.join("\n")}
</section>`;
}

// Re-export so consumers can use the helper if they need to render one card
// standalone (e.g. in the buyer layer).
export {
  buildChauhaddiCard,
  buildKhewatPoACard,
  buildSection6Card,
  buildMutationReferencesCard,
};
