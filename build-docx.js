// ClearDeed — 2-page Executive Brief (designed)
//
// Design intent: a confident, executive-grade brief that reads in 90 seconds.
// Page 1: hero + product thesis + pipeline diagram + sources we touch.
// Page 2: pull-quote + what we extract + what the customer gets + liability frame.

const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, PageOrientation, LevelFormat,
  BorderStyle, WidthType, ShadingType, VerticalAlign, PageNumber,
  PageBreak, HeadingLevel, TabStopType, TabStopPosition, LineRuleType,
} = require("docx");

// ─── Design tokens ──────────────────────────────────────────────────────
const COLOR = {
  ink:      "141A2B",   // body text
  primary:  "1B2A4E",   // deep navy
  primaryD: "0F1A33",   // darker navy (for deepest blocks)
  slate:    "5A6B85",   // secondary text
  rule:     "C8CFDB",   // hairline rules
  ruleSoft: "E4E8EF",
  panel:    "F5F2EA",   // warm neutral panel
  panelAlt: "EEF1F7",   // cool panel
  panelDk:  "F9FAFC",   // near-white panel
  accent:   "B88A2E",   // muted antique gold
  accentLt: "D9B85E",   // lighter gold for hairlines
  success:  "2E6F40",
  warn:     "8A5A2B",
  danger:   "8C2E2E",
  white:    "FFFFFF",
};

const FONT_DISPLAY = "Georgia";
const FONT_BODY    = "Calibri";

// ─── Helpers ────────────────────────────────────────────────────────────
const thin = (color = COLOR.rule, size = 4) => ({ style: BorderStyle.SINGLE, size, color });
const hairline = (color = COLOR.rule, size = 2) => ({ style: BorderStyle.SINGLE, size, color });

function P(opts) { return new Paragraph(opts); }

function T(text, opts = {}) {
  return new TextRun({ text, font: FONT_BODY, size: 20, color: COLOR.ink, ...opts });
}

function Dsp(text, opts = {}) {
  // Display text: serif, navy.
  return new TextRun({ text, font: FONT_DISPLAY, color: COLOR.primary, ...opts });
}

function Eyebrow(text, color = COLOR.accent) {
  return new TextRun({
    text: text.toUpperCase(),
    font: FONT_BODY, size: 16, bold: true, color, characterSpacing: 60,
  });
}

function cell({ children, width, fill, vAlign = VerticalAlign.CENTER, padding = 100 }) {
  const pad = typeof padding === "number" ? { top: padding, bottom: padding, left: 140, right: 140 } : { top: 100, bottom: 100, ...padding };
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
               bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
               left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
               right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
    margins: pad,
    verticalAlign: vAlign,
    children: Array.isArray(children) ? children : [children],
  });
}

function rowOf(cells) {
  return new TableRow({ cantSplit: true, children: cells });
}

function spacer(pts = 6) {
  return P({ spacing: { before: 0, after: pts * 20, line: 240, lineRule: LineRuleType.AUTO }, children: [T(" ")] });
}

// Two-column section header with eyebrow on the left, title underneath
function sectionHeader(eyebrow, title, accent = COLOR.primary) {
  return P({
    spacing: { before: 240, after: 140, line: 320, lineRule: LineRuleType.AUTO },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: accent, space: 4 } },
    children: [
      Eyebrow(eyebrow, COLOR.accent),
      new TextRun({ text: "  ", size: 16 }),
      new TextRun({ text: title, font: FONT_DISPLAY, size: 28, bold: true, color: accent, break: 1 }),
    ],
  });
}

// ────────────────────────────────────────────────────────────────────────
// PAGE 1 COMPONENTS
// ────────────────────────────────────────────────────────────────────────

// Cover band: brand strip + wordmark + tagline + classification
function coverBand() {
  // Two-row cover: top thin band with classification, big wordmark, tagline, bottom band with date
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.SINGLE, size: 18, color: COLOR.accent, space: 0 },
      left: { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
    },
    rows: [
      // Row 1: navy block with wordmark + tagline
      new TableRow({
        cantSplit: true,
        children: [cell({
          width: 9360,
          fill: COLOR.primary,
          padding: { top: 360, bottom: 280, left: 360, right: 360 },
          vAlign: VerticalAlign.CENTER,
          children: [
            // Top eyebrow with classification
            P({ spacing: { after: 200 }, children: [
              new TextRun({
                text: "EXECUTIVE BRIEF", font: FONT_BODY, size: 16, bold: true, color: COLOR.accentLt, characterSpacing: 120,
              }),
              new TextRun({ text: "    ·    ", font: FONT_BODY, size: 16, color: "8A95AE" }),
              new TextRun({
                text: "CONFIDENTIAL", font: FONT_BODY, size: 16, bold: true, color: "8A95AE", characterSpacing: 120,
              }),
            ]}),
            // Big wordmark
            P({ spacing: { after: 0, line: 360, lineRule: LineRuleType.AUTO }, children: [
              new TextRun({
                text: "ClearDeed", font: FONT_DISPLAY, size: 84, bold: true, color: COLOR.white, characterSpacing: 20,
              }),
            ]}),
            // Tagline (italic serif, muted)
            P({ spacing: { before: 80, after: 0, line: 320, lineRule: LineRuleType.AUTO }, children: [
              new TextRun({
                text: "One-click property verification for the Indian land buyer.", font: FONT_DISPLAY, size: 26, italics: true, color: "C7CFE0",
              }),
            ]}),
          ],
        })],
      }),
      // Row 2: cream strip with date / version
      new TableRow({
        cantSplit: true,
        children: [cell({
          width: 9360,
          fill: COLOR.panel,
          padding: { top: 80, bottom: 80, left: 360, right: 360 },
          vAlign: VerticalAlign.CENTER,
          children: P({ children: [
            new TextRun({ text: "Issue 1  ·  June 2026  ·  Founder & Investor Brief", font: FONT_BODY, size: 16, color: COLOR.slate, characterSpacing: 40 }),
          ]}),
        })],
      }),
    ],
  });
}

// Thesis: a one-sentence product statement + three short pillars
function thesis() {
  const thesis = P({
    spacing: { before: 320, after: 200, line: 360, lineRule: LineRuleType.AUTO },
    children: [
      new TextRun({
        text: "Given a plot and a claimed owner, ClearDeed returns a plain-English report — citing the public record — that tells the buyer exactly what is verified, what is not, and what to ask next.",
        font: FONT_DISPLAY, size: 30, color: COLOR.primary,
      }),
    ],
  });

  // Three pillars as a 3-column table
  const pillars = [
    {
      n: "01",
      h: "One click, not 8 hours",
      b: "What takes a lawyer 4–8 hours and ₹5,000–10,000, ClearDeed returns in minutes and at a fraction of the cost.",
    },
    {
      n: "02",
      h: "Reconciliation over verdict",
      b: "If the record, the map, and the seller disagree, the disagreement is the finding. We never score the plot. We never say “safe to buy.”",
    },
    {
      n: "03",
      h: "English, not Odia legalese",
      b: "Bhulekh, IGR, eCourts and Bhunaksha output in Odia, scattered across five portals. We resolve the script, the village, the plot, and the parties.",
    },
  ];

  const pillarTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3120, 3120, 3120],
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: COLOR.rule },
    },
    rows: [rowOf(pillars.map((p, i) => cell({
      width: 3120,
      fill: i === 1 ? COLOR.panelDk : COLOR.white,
      padding: { top: 160, bottom: 160, left: 200, right: 200 },
      children: [
        P({ spacing: { after: 100 }, children: [
          new TextRun({ text: p.n, font: FONT_DISPLAY, size: 36, bold: true, color: COLOR.accent }),
        ]}),
        P({ spacing: { after: 120, line: 300, lineRule: LineRuleType.AUTO }, children: [
          new TextRun({ text: p.h, font: FONT_DISPLAY, size: 22, bold: true, color: COLOR.primary }),
        ]}),
        P({ spacing: { line: 300, lineRule: LineRuleType.AUTO }, children: [
          T(p.b, { size: 20 }),
        ]}),
      ],
    })))],
  });

  return [thesis, pillarTable];
}

// Pipeline diagram: 5 stages (Input → Resolve → Pull → Reconcile → Deliver)
function pipeline() {
  const stages = [
    { k: "INPUT",     t: "Plot ID",      s: "ULPIN, khatiyan,\ntenant, GPS" },
    { k: "RESOLVE",   t: "Find the RoR", s: "Village, RI circle,\ntehsil, khatian" },
    { k: "PULL",      t: "5 portals",    s: "Bhulekh, IGR, eCourts,\nBhunaksha, overlays" },
    { k: "RECONCILE", t: "Cross-check",  s: "Owner, area, dates,\nplot ID, disputes" },
    { k: "DELIVER",   t: "6-section PDF",s: "Plain English,\ncited, no verdict" },
  ];

  const arrowCell = (txt) => cell({
    width: 200,
    fill: COLOR.white,
    vAlign: VerticalAlign.CENTER,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
    children: P({ alignment: AlignmentType.CENTER, children: [
      new TextRun({ text: txt, font: FONT_DISPLAY, size: 32, bold: true, color: COLOR.accent }),
    ]}),
  });

  const stageCell = (s, isLast) => cell({
    width: isLast ? 1772 : 1672,
    fill: s.fill,
    vAlign: VerticalAlign.CENTER,
    padding: { top: 160, bottom: 160, left: 160, right: 160 },
    children: [
      P({ spacing: { after: 80 }, children: [
        new TextRun({ text: s.k, font: FONT_BODY, size: 14, bold: true, color: COLOR.accent, characterSpacing: 80 }),
      ]}),
      P({ spacing: { after: 80, line: 280, lineRule: LineRuleType.AUTO }, children: [
        new TextRun({ text: s.t, font: FONT_DISPLAY, size: 22, bold: true, color: COLOR.primary }),
      ]}),
      P({ spacing: { line: 260, lineRule: LineRuleType.AUTO }, children: [
        T(s.s, { size: 17, color: COLOR.slate }),
      ]}),
    ],
  });

  const cells = [];
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    s.fill = (i % 2 === 0) ? COLOR.primary : COLOR.primaryD;
    cells.push(stageCell(s, i === stages.length - 1));
    if (i < stages.length - 1) cells.push(arrowCell("›"));
  }

  // Total width: 5 stages + 4 arrows. 5*1672 + 4*200 = 8360 + 800 = 9160; +last cell 100 = 9260
  // We want exactly 9360. Recompute: arrows 200, 4 arrows = 800; stages 5 * (9360-800)/5 = 1712.
  // Simplify: rebuild with stage width 1712 (not 1672) and last cell 1712.
  const stageCells = [];
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    s.fill = (i % 2 === 0) ? COLOR.primary : COLOR.primaryD;
    stageCells.push(cell({
      width: 1712,
      fill: s.fill,
      vAlign: VerticalAlign.CENTER,
      padding: { top: 160, bottom: 160, left: 140, right: 140 },
      children: [
        P({ spacing: { after: 80 }, children: [
          new TextRun({ text: s.k, font: FONT_BODY, size: 14, bold: true, color: COLOR.accentLt, characterSpacing: 80 }),
        ]}),
        P({ spacing: { after: 80, line: 280, lineRule: LineRuleType.AUTO }, children: [
          new TextRun({ text: s.t, font: FONT_DISPLAY, size: 22, bold: true, color: COLOR.white }),
        ]}),
        P({ spacing: { line: 260, lineRule: LineRuleType.AUTO }, children: [
          new TextRun({ text: s.s, font: FONT_BODY, size: 16, color: "C7CFE0" }),
        ]}),
      ],
    }));
    if (i < stages.length - 1) {
      stageCells.push(cell({
        width: 200,
        fill: COLOR.white,
        vAlign: VerticalAlign.CENTER,
        padding: { top: 0, bottom: 0, left: 0, right: 0 },
        children: P({ alignment: AlignmentType.CENTER, children: [
          new TextRun({ text: "›", font: FONT_DISPLAY, size: 36, bold: true, color: COLOR.accent }),
        ]}),
      }));
    }
  }

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1712, 200, 1712, 200, 1712, 200, 1712, 200, 1712],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
    },
    rows: [rowOf(stageCells)],
  });
}

// Sources table (with status pill colors)
function sourcesTable() {
  const rows = [
    ["Bhulekh",            "Primary",    "RoR Front + Back pages; tenant, plot, khatiyan, mutation, kisam, due amounts. Transliterated from Odia, reconciled in English."],
    ["Bhunaksha (ORSAC)",  "Primary",    "Cadastral map and parcel polygon; village boundary; tehsil and RI circle from authoritative map data."],
    ["IGR Odisha",         "Concierge",  "Index-II and Encumbrance Certificate. V1: instructions + structured intake. V1.5+: automated fetch with manual review."],
    ["eCourts",            "Partial",    "District and High Court case search against the claimed owner and seller-claimed name variants."],
    ["RCCMS",              "Placeholder","Revenue court case status. Parser ready; live access gated by portal uptime and captcha behaviour."],
    ["CERSAI",             "Roadmap",    "Central registry of mortgages and security interests on property. V2 add-on."],
    ["RERA Odisha",        "Roadmap",    "Project and promoter registration. Triggered for marketed layouts, not standalone plots."],
    ["Nominatim + WFS",    "Supporting", "GPS to location metadata; village boundary cross-check; coordinates for the satellite panel."],
  ];

  const statusColor = (s) => s === "Primary"    ? COLOR.success
                     : s === "Concierge"  ? COLOR.accent
                     : s === "Partial"    ? COLOR.warn
                     : s === "Placeholder"? COLOR.warn
                     :                       COLOR.slate;

  const headerCells = [
    cell({ width: 2640, fill: COLOR.primary, vAlign: VerticalAlign.CENTER, padding: { top: 140, bottom: 140, left: 160, right: 160 },
      children: P({ children: [new TextRun({ text: "SOURCE", font: FONT_BODY, size: 16, bold: true, color: COLOR.white, characterSpacing: 80 })] }) }),
    cell({ width: 1320, fill: COLOR.primary, vAlign: VerticalAlign.CENTER, padding: { top: 140, bottom: 140, left: 160, right: 160 },
      children: P({ children: [new TextRun({ text: "STATUS", font: FONT_BODY, size: 16, bold: true, color: COLOR.white, characterSpacing: 80 })] }) }),
    cell({ width: 5400, fill: COLOR.primary, vAlign: VerticalAlign.CENTER, padding: { top: 140, bottom: 140, left: 160, right: 160 },
      children: P({ children: [new TextRun({ text: "WHAT WE EXTRACT", font: FONT_BODY, size: 16, bold: true, color: COLOR.white, characterSpacing: 80 })] }) }),
  ];

  const dataRows = rows.map(([src, status, what], i) => rowOf([
    cell({ width: 2640, fill: i % 2 === 0 ? COLOR.white : COLOR.panelDk, vAlign: VerticalAlign.CENTER,
      children: P({ children: [new TextRun({ text: src, font: FONT_BODY, size: 20, bold: true, color: COLOR.ink })] }) }),
    cell({ width: 1320, fill: i % 2 === 0 ? COLOR.white : COLOR.panelDk, vAlign: VerticalAlign.CENTER,
      children: P({ children: [new TextRun({ text: status.toUpperCase(), font: FONT_BODY, size: 16, bold: true, color: statusColor(status), characterSpacing: 60 })] }) }),
    cell({ width: 5400, fill: i % 2 === 0 ? COLOR.white : COLOR.panelDk, vAlign: VerticalAlign.CENTER,
      children: P({ spacing: { line: 280, lineRule: LineRuleType.AUTO }, children: [T(what, { size: 18 })] }) }),
  ]));

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2640, 1320, 5400],
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 8, color: COLOR.primary, space: 0 },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: COLOR.primary, space: 0 },
      left:   { style: BorderStyle.SINGLE, size: 4, color: COLOR.rule },
      right:  { style: BorderStyle.SINGLE, size: 4, color: COLOR.rule },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: COLOR.ruleSoft },
      insideVertical:   { style: BorderStyle.SINGLE, size: 4, color: COLOR.rule },
    },
    rows: [rowOf(headerCells), ...dataRows],
  });
}

// ────────────────────────────────────────────────────────────────────────
// PAGE 2 COMPONENTS
// ────────────────────────────────────────────────────────────────────────

function page2Header() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.SINGLE, size: 18, color: COLOR.accent, space: 0 },
      left: { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
    },
    rows: [new TableRow({
      cantSplit: true,
      children: [cell({
        width: 9360,
        fill: COLOR.primary,
        padding: { top: 200, bottom: 200, left: 360, right: 360 },
        vAlign: VerticalAlign.CENTER,
        children: P({ children: [
          new TextRun({ text: "CLEARDEED", font: FONT_DISPLAY, size: 18, bold: true, color: COLOR.accent, characterSpacing: 100 }),
          new TextRun({ text: "    ·    Page Two: What the buyer sees, and what the buyer gets.", font: FONT_DISPLAY, size: 18, italics: true, color: "C7CFE0" }),
        ]}),
      })],
    })],
  });
}

function pullQuote() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      left:   { style: BorderStyle.SINGLE, size: 32, color: COLOR.accent, space: 0 },
      right:  { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
    },
    rows: [new TableRow({
      cantSplit: true,
      children: [cell({
        width: 9360,
        fill: COLOR.panel,
        padding: { top: 240, bottom: 240, left: 320, right: 320 },
        vAlign: VerticalAlign.CENTER,
        children: [
          P({ spacing: { after: 120, line: 360, lineRule: LineRuleType.AUTO }, children: [
            new TextRun({ text: "“", font: FONT_DISPLAY, size: 56, bold: true, color: COLOR.accent }),
            new TextRun({ text: " The consumer does not want a verdict. They want ", font: FONT_DISPLAY, size: 26, italics: true, color: COLOR.ink }),
            new TextRun({ text: "informed anxiety.", font: FONT_DISPLAY, size: 26, italics: true, bold: true, color: COLOR.primary }),
            new TextRun({ text: " A good ClearDeed report reduces uncertainty on the dimensions that can be verified, and explicitly surfaces the dimensions that cannot — so the buyer knows which questions to ask next.", font: FONT_DISPLAY, size: 26, italics: true, color: COLOR.ink }),
          ]}),
          P({ alignment: AlignmentType.RIGHT, spacing: { before: 100, after: 0 }, children: [
            new TextRun({ text: "— PRODUCT.md, §2 (Critical insight for report design)", font: FONT_BODY, size: 16, color: COLOR.slate, characterSpacing: 20 }),
          ]}),
        ],
      })],
    })],
  });
}

function extractionTable() {
  const items = [
    ["Identity",     "Plot ULPIN, khatiyan number, mouza, RI circle, tehsil, district. The official identifiers — not addresses."],
    ["Owner",        "Recorded owner in Odia and English transliteration, father's or husband's name, share, joint-ownership flags, tenant-vs-owner distinction."],
    ["History",      "Sequence of mutations: sale, gift, inheritance, partition, mortgage. Dates, party names, document numbers — what was transferred and when."],
    ["Classification","Kisam (revenue class), permitted use, conversion status, buildability notes. Revenue classification is kept distinct from zoning or building permission."],
    ["Encumbrance",  "Active mortgages, liens, attachments, and the 30-year history captured in the EC. Includes confidence notes where the EC is manual or partial."],
    ["Disputes",     "Court and revenue-court cases linked to the plot, the owner, or seller-claimed name variants — with captcha retries, name-variant fuzzing, and negative-result caveats."],
    ["Regulatory",   "Proximity to protected zones: forest, coastal CRZ, PESA tribal, airport, archaeological, flood. Flagged, not certified."],
    ["Geospatial",   "Plot polygon on the cadastral map; village boundary; coordinates; satellite view; subdivision context."],
  ];

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2160, 7200],
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      left:   { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      right:  { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: COLOR.ruleSoft },
      insideVertical:   { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
    },
    rows: items.map(([k, v], i) => rowOf([
      cell({
        width: 2160,
        fill: COLOR.panelAlt,
        vAlign: VerticalAlign.CENTER,
        padding: { top: 140, bottom: 140, left: 180, right: 180 },
        children: P({ children: [
          new TextRun({ text: k, font: FONT_DISPLAY, size: 22, bold: true, color: COLOR.primary }),
        ]}),
      }),
      cell({
        width: 7200,
        vAlign: VerticalAlign.CENTER,
        padding: { top: 140, bottom: 140, left: 200, right: 180 },
        children: P({ spacing: { line: 280, lineRule: LineRuleType.AUTO }, children: [T(v, { size: 20 })] }),
      }),
    ])),
  });
}

function customerReportTable() {
  const items = [
    ["1", "The Plot",                 "Plot ID, location, what the revenue map shows, satellite context. What matched, what didn't."],
    ["2", "The Owner",                "Recorded owner, family details, joint-ownership notes, owner-vs-tenant distinction, last-update timestamp."],
    ["3", "What you can build here",  "Kisam, permitted use, conversion status, buildability flags, and what permissions are still owed."],
    ["4", "Encumbrances & disputes",  "Court cases, EC status, mutation history, and exactly which records were checked and which require a Sub-Registrar visit."],
    ["5", "Regulatory flags",         "Protected-zone proximity, with caveats. A flag is a question to investigate — not a clearance."],
    ["6", "What to ask next",         "A specific checklist of questions for the seller, the broker, and a lawyer. The report's primary action."],
  ];

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [560, 2520, 6280],
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 8, color: COLOR.primary, space: 0 },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: COLOR.primary, space: 0 },
      left:   { style: BorderStyle.SINGLE, size: 4, color: COLOR.rule },
      right:  { style: BorderStyle.SINGLE, size: 4, color: COLOR.rule },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: COLOR.ruleSoft },
      insideVertical:   { style: BorderStyle.SINGLE, size: 4, color: COLOR.rule },
    },
    rows: items.map(([n, t, d], i) => rowOf([
      cell({
        width: 560,
        fill: COLOR.primary,
        vAlign: VerticalAlign.CENTER,
        padding: { top: 140, bottom: 140, left: 100, right: 100 },
        children: P({ alignment: AlignmentType.CENTER, children: [
          new TextRun({ text: n, font: FONT_DISPLAY, size: 32, bold: true, color: COLOR.accent }),
        ]}),
      }),
      cell({
        width: 2520,
        fill: i % 2 === 0 ? COLOR.white : COLOR.panelDk,
        vAlign: VerticalAlign.CENTER,
        padding: { top: 140, bottom: 140, left: 180, right: 180 },
        children: P({ children: [
          new TextRun({ text: t, font: FONT_DISPLAY, size: 22, bold: true, color: COLOR.primary }),
        ]}),
      }),
      cell({
        width: 6280,
        fill: i % 2 === 0 ? COLOR.white : COLOR.panelDk,
        vAlign: VerticalAlign.CENTER,
        padding: { top: 140, bottom: 140, left: 200, right: 180 },
        children: P({ spacing: { line: 280, lineRule: LineRuleType.AUTO }, children: [T(d, { size: 20 })] }),
      }),
    ])),
  });
}

// Stats / output band
function statsBand() {
  const stats = [
    { v: "4–6",        l: "Page report" },
    { v: "5",          l: "Source families" },
    { v: "0",          l: "Verdicts given" },
    { v: "₹499",       l: "Per report" },
  ];

  const cellsArr = stats.map((s, i) => cell({
    width: 2340,
    fill: i % 2 === 0 ? COLOR.primaryD : COLOR.primary,
    vAlign: VerticalAlign.CENTER,
    padding: { top: 200, bottom: 200, left: 240, right: 240 },
    children: [
      P({ spacing: { after: 60 }, children: [
        new TextRun({ text: s.v, font: FONT_DISPLAY, size: 44, bold: true, color: COLOR.accent }),
      ]}),
      P({ children: [
        new TextRun({ text: s.l.toUpperCase(), font: FONT_BODY, size: 14, bold: true, color: "C7CFE0", characterSpacing: 80 }),
      ]}),
    ],
  }));

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2340, 2340, 2340, 2340],
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      left:   { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      right:  { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      insideVertical:   { style: BorderStyle.SINGLE, size: 4, color: COLOR.primaryD },
    },
    rows: [rowOf(cellsArr)],
  });
}

function liabilityPanel() {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: COLOR.accent, space: 0 },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.accent, space: 0 },
      left:   { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      right:  { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
    },
    rows: [new TableRow({
      cantSplit: true,
      children: [cell({
        width: 9360,
        fill: COLOR.panel,
        padding: { top: 200, bottom: 200, left: 240, right: 240 },
        vAlign: VerticalAlign.CENTER,
        children: [
          P({ spacing: { after: 100 }, children: [
            new TextRun({ text: "LIABILITY FRAME", font: FONT_BODY, size: 14, bold: true, color: COLOR.accent, characterSpacing: 100 }),
          ]}),
          P({ spacing: { line: 300, lineRule: LineRuleType.AUTO }, children: [
            new TextRun({
              text: "ClearDeed reports structured facts from public records and flags inconsistencies. It does not certify title, guarantee against fraud, recommend transactions, or substitute for legal or professional advice. Every report visibly carries this disclaimer in consumer-grade language. A report that says “everything is clear, go ahead” is not a ClearDeed report.",
              font: FONT_BODY, size: 18, color: COLOR.ink,
            }),
          ]}),
        ],
      })],
    })],
  });
}

// ────────────────────────────────────────────────────────────────────────
// FOOTER
// ────────────────────────────────────────────────────────────────────────
function makeFooter() {
  return new Footer({
    children: [
      P({
        spacing: { before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: COLOR.rule, space: 6 } },
        tabStops: [{ type: TabStopType.CENTER, position: 4680 }, { type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: "ClearDeed  ·  cleardeed.in", font: FONT_BODY, size: 14, color: COLOR.slate }),
          new TextRun({ text: "\t", font: FONT_BODY, size: 14 }),
          new TextRun({ text: "Executive Brief  ·  June 2026", font: FONT_BODY, size: 14, color: COLOR.slate }),
          new TextRun({ text: "\t", font: FONT_BODY, size: 14 }),
          new TextRun({ text: "Page ", font: FONT_BODY, size: 14, color: COLOR.slate }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT_BODY, size: 14, bold: true, color: COLOR.primary }),
          new TextRun({ text: " of ", font: FONT_BODY, size: 14, color: COLOR.slate }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT_BODY, size: 14, bold: true, color: COLOR.primary }),
        ],
      }),
    ],
  });
}

// ────────────────────────────────────────────────────────────────────────
// ASSEMBLY
// ────────────────────────────────────────────────────────────────────────
function buildDocument() {
  const children = [];

  // ── PAGE 1 ──
  children.push(coverBand());
  const [thesisP, pillarT] = thesis();
  children.push(thesisP);
  children.push(pillarT);

  children.push(sectionHeader("01 · The pipeline", "From a plot ID to a 6-section report", COLOR.primary));
  children.push(P({ spacing: { before: 80, after: 140, line: 300, lineRule: LineRuleType.AUTO }, children: [
    new TextRun({
      text: "Five stages. Each gated. Each cited. Each a separate specialist agent in the council.",
      font: FONT_BODY, size: 20, italics: true, color: COLOR.slate,
    }),
  ]}));
  children.push(pipeline());
  children.push(spacer(8));

  children.push(sectionHeader("02 · The sources", "Where the report's facts come from", COLOR.primary));
  children.push(P({ spacing: { before: 80, after: 140, line: 300, lineRule: LineRuleType.AUTO }, children: [
    new TextRun({
      text: "Every report is built from a council of public-record sources, each with a known reliability posture. The moat is cross-source reconciliation — not source count.",
      font: FONT_BODY, size: 20, italics: true, color: COLOR.slate,
    }),
  ]}));
  children.push(sourcesTable());

  // ── PAGE 2 ──
  children.push(P({ children: [new PageBreak()] }));
  children.push(page2Header());
  children.push(spacer(6));

  children.push(pullQuote());
  children.push(spacer(8));

  children.push(sectionHeader("03 · The extraction", "What we extract from each plot", COLOR.primary));
  children.push(extractionTable());
  children.push(spacer(8));

  children.push(sectionHeader("04 · The deliverable", "What the customer gets", COLOR.primary));
  children.push(P({ spacing: { before: 80, after: 140, line: 300, lineRule: LineRuleType.AUTO }, children: [
    new TextRun({
      text: "A 4–6 page report, plain English, mobile-responsive and PDF. Six sections, no verdicts, every fact cited to source, every gap labelled as a manual follow-up.",
      font: FONT_BODY, size: 20, italics: true, color: COLOR.slate,
    }),
  ]}));
  children.push(customerReportTable());
  children.push(spacer(8));

  children.push(sectionHeader("05 · The output", "What the report looks like in numbers", COLOR.primary));
  children.push(statsBand());
  children.push(spacer(8));

  children.push(liabilityPanel());

  return new Document({
    creator: "ClearDeed",
    title: "ClearDeed — Executive Brief",
    description: "What ClearDeed does, the sources it touches, what it extracts, and what the customer receives.",
    styles: {
      default: {
        document: { run: { font: FONT_BODY, size: 20, color: COLOR.ink } },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT },
          margin: { top: 1008, right: 1008, bottom: 1008, left: 1008 }, // 0.7"
        },
      },
      headers: { default: new Header({ children: [P({ children: [new TextRun({ text: "" })] })] }) },
      footers: { default: makeFooter() },
      children,
    }],
  });
}

Packer.toBuffer(buildDocument()).then((buf) => {
  fs.writeFileSync("/Users/deekshamohapatra/Documents/cleardeed/ClearDeed-Executive-Brief.docx", buf);
  console.log("OK: wrote ClearDeed-Executive-Brief.docx (" + buf.length + " bytes)");
});
