# ClearDeed Report — Implementation Spec (locked 2026-06-22)

**Source:** Decisions captured in [BRAINSTORM_DATA_VALUE_AND_SHOWCASE.md](agents/consumer-report-writer/BRAINSTORM_DATA_VALUE_AND_SHOWCASE.md) Parts 1–10 + Appendices A/B.
**Audience:** Implementer (myself, next session). Each section below has the data inputs, the HTML/CSS shape, and the file:line target.

---

## Section Order (top → bottom of the rendered report)

1. **HERO** — plot identity + owner match + land type + tested patterns verdict (1 critical concern | 0 watchouts | 0 verified | 0 source observations)
2. **TESTED FRAUD PATTERNS PANEL** — 5 patterns, each with explicit pass/fail + evidence + source + timestamp
3. **SOURCE TRUST STRIP** — one row of pills: ✅ Bhulekh 92% | ✅ Bhunaksha 88% | ✅ eCourts 65% (captcha) | ⏳ IGR EC manual | ⏳ CERSAI manual | ⏳ Bhuvan
4. **PLOT DIAGRAM (redrawn)** — target highlighted, 4 cardinal neighbours with owner names, chauhaddi arrows overlay, provenance strip (S2)
5. **6-Q GRID** — 6 tiles, each: severity badge + leading headline + count of red/amber/green insights
6. **Q-DETAIL PANELS** (one per Q, accordion) — narrative at top + per-insight rows with raw Odia + provenance
7. **MUTATION TIMELINE** — vertical visual timeline with entries and gaps (S2)
8. **FOOTER** — disclaimers, "consult a lawyer", sources list

Total: 1 page visible above the fold (hero + patterns + source strip + Q-grid tiles). 4–6 pages including all detail panels.

---

## Section 1: HERO

**File target:** New `buildHeroStrip(input)` function in [agents/consumer-report-writer/src/index.ts](agents/consumer-report-writer/src/index.ts) (replaces the inline hero logic in `buildBuyerPage`). Inserted before the existing narrative sections.

**Inputs:**
- `input.identity` — `{ plotNo, khataNo, mouza, village, tahasil, district, areaAcres }`
- `input.owner` — `{ officialName, transliteratedName, ownerNameOdiaRaw, nameMatch, coOwnersCount, fatherName, caste, residence, ownerFieldMissing, hasPoA }`
- `input.land` — `{ primaryKisam, primaryCategory, conversionRequired, bdaZone }`
- `input.testedPatterns` — `{ firedCount, totalTested, leadingPatternName? }`
- `input.verdict` — `{ tier: 'critical_concern' | 'watchout' | 'verified' | 'gap', oneSentence }`

**HTML shape:**

```html
<section class="hero-strip" data-verdict-tier="critical_concern">
  <div class="hero-identity">
    <h1 class="hero-title">Mendhasala 309</h1>
    <div class="hero-sub">10.5 acres · Khatiyan 830 · Patia, Khordha</div>
    <a href="https://bhulekh.ori.nic.in/..." class="hero-trust-strip">
      <span class="trust-source">📜 bhulekh.ori.nic.in</span>
      <span class="trust-time">⏱ Retrieved 2026-05-13 14:23 IST</span>
      <span class="trust-hash">🔒 7a3f9b2c</span>
    </a>
  </div>
  <div class="hero-card hero-owner">
    <div class="hero-card-label">OWNER (Bhulekh RoR)</div>
    <div class="hero-card-value">Krushnachandra Barajena</div>
    <div class="hero-card-rawodia">📜 କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା</div>
    <div class="hero-card-detail">Father: Pratima · Category: SC · 4 co-owners</div>
    <div class="hero-card-warn" data-state="match-mismatch">
      ⚠ Name does not match your seller "Mohapatra"
    </div>
  </div>
  <div class="hero-card hero-land">
    <div class="hero-card-label">LAND</div>
    <div class="hero-card-value">Agricultural (ଦଣ୍ଡା)</div>
    <div class="hero-card-detail">BDA zone: Residential · Conversion: Required</div>
  </div>
  <div class="hero-verdict">
    <div class="verdict-eyebrow">BUYER'S VERDICT</div>
    <div class="verdict-headline" data-tier="critical_concern">
      Critical Concern — Name mismatch + impersonation pattern
    </div>
    <div class="verdict-detail">
      1 critical concern · 2 watchouts · 2 source observations · 1 gap
    </div>
    <div class="verdict-patterns">
      🛑 Pattern 3 (Malipada Impersonation) TRIGGERED · ✅ Patterns 1, 2, 4, 5 passed
    </div>
  </div>
</section>
```

**Removed:** No `buildFinancialExposureSummary`. No `₹`. The verdict uses the qualitative tier.

---

## Section 2: TESTED FRAUD PATTERNS PANEL

**File target:** New `buildTestedPatternsPanel(patterns, firedRuleIds)` function in same file.

**Inputs:**
- `patterns[]` — 5 hardcoded pattern definitions (one per CLAUDE.md Section 3 fraud pattern list)
- `firedRuleIds` — `string[]` from `insights.map(i => i.ruleId)` filter
- Each pattern definition has: `{ id, name, description, detectionRuleIds: string[], source }`

**HTML shape (one panel, 5 rows):**

```html
<section class="tested-patterns" id="tested-patterns">
  <div class="tp-header">
    <div class="tp-eyebrow">TESTED FRAUD PATTERNS (Khordha 2024–2026)</div>
    <div class="tp-summary">4 of 5 patterns passed · 1 triggered</div>
  </div>
  <ol class="tp-list">
    <li class="tp-row" data-state="passed">
      <div class="tp-icon">✅</div>
      <div class="tp-body">
        <div class="tp-name">1. Patia Industrial-Lease Scam</div>
        <div class="tp-check">Check: IGR RLD prefix + Sthitiban/Raiyati khata</div>
        <div class="tp-result">No lease tenure indicator, RoR shows private ownership</div>
        <div class="tp-evidence">
          Rules: <code>ROR-INS-180</code> · Source: <a href="...">Bhulekh RoR</a>
          · Trust: 88% · Tested 2026-05-13 14:23
        </div>
      </div>
    </li>
    <li class="tp-row" data-state="triggered">
      <div class="tp-icon">🛑</div>
      <div class="tp-body">
        <div class="tp-name">3. Malipada Impersonation Scam</div>
        <div class="tp-check">Check: Seller address ≠ plot district + no PoA on record</div>
        <div class="tp-result">Seller "Mohapatra" (Cuttack) ≠ plot (Khordha), no PoA on record</div>
        <div class="tp-evidence">
          Rules: <code>ROR-INS-024</code>, <code>ROR-INS-025</code>, <code>ROR-INS-075</code>
          · Source: <a href="...">Bhulekh + IGR SRO</a> · Trust: 82% · Tested 2026-05-13 14:23
        </div>
        <div class="tp-action">→ Action: Video KYC with seller + direct contact with Barajena</div>
      </div>
    </li>
    <!-- …4 more rows… -->
  </ol>
</section>
```

**Visible when all 5 pass:** Still shows all 5 with ✅. The trust signal is "we know the local scams."

---

## Section 3: SOURCE TRUST STRIP

**File target:** New `buildSourceTrustStrip(sources)` function. Universal pattern — also used inline under every fact.

**Inputs:**
- `sources[]` — each `{ name, status: 'live' | 'manual' | 'error', confidence, fetchedAt, attempts, warnings }`

**HTML shape:**

```html
<div class="source-trust-strip">
  <a class="src-pill" data-status="live" href="https://bhulekh.ori.nic.in/...">
    <span class="src-status">✅</span>
    <span class="src-name">Bhulekh</span>
    <span class="src-conf">92%</span>
  </a>
  <a class="src-pill" data-status="live" href="https://bhunaksha...">
    <span class="src-status">✅</span>
    <span class="src-name">Bhunaksha</span>
    <span class="src-conf">88%</span>
  </a>
  <a class="src-pill" data-status="partial" href="https://ecourts...">
    <span class="src-status">⚠️</span>
    <span class="src-name">eCourts</span>
    <span class="src-conf">65%</span>
    <span class="src-meta">3 captcha retries</span>
  </a>
  <a class="src-pill" data-status="manual" href="...">
    <span class="src-status">⏳</span>
    <span class="src-name">IGR EC</span>
    <span class="src-conf">manual</span>
  </a>
</div>
```

**Reusable inline pattern** (under every fact, where space permits):

```html
<div class="fact-trust-strip">
  <span class="fts-source">📜 bhulekh.ori.nic.in</span>
  <span class="fts-time">⏱ 14:23</span>
  <span class="fts-hash">🔒 7a3f9b2c</span>
  <span class="fts-parser">🔧 v3.2</span>
  <span class="fts-attempts">🔁 1 attempt</span>
</div>
```

If a row has >5 attributes, hide lower-priority ones on mobile.

---

## Section 4: PLOT DIAGRAM (Sprint 2)

See Appendix B of the brainstorm doc for full T-14 breakdown. Implementation target: `packages/render/src/plot-diagram-svg.ts` + new `bhunaksha-plot-report-per-neighbour` orchestrator step.

---

## Section 5: 6-Q GRID

**File target:** Rewrites existing `buildQGrid` in [agents/consumer-report-writer/src/index.ts:2136](agents/consumer-report-writer/src/index.ts#L2136).

**Inputs (existing):**
- `input.tiles[]` — one per question
- `input.talliesByQuestion` — already-computed by `tallyInsightsByBuyerQuestion`

**HTML shape (per tile):**

```html
<a class="q-tile" data-question="1" href="#q1-detail">
  <div class="q-tile-num">Q1</div>
  <div class="q-tile-q">Does the seller actually own this?</div>
  <div class="q-tile-severity" data-tier="critical_concern">
    <span class="q-ts-icon">🛑</span>
    <span class="q-ts-text">Critical Concern</span>
  </div>
  <div class="q-tile-tally">
    <span class="qt-badge qt-red">2 red</span>
    <span class="qt-badge qt-amber">1 watch</span>
    <span class="qt-badge qt-green">1 verified</span>
  </div>
  <div class="q-tile-leading">
    Name does not match the Bhulekh record (ROR-INS-024)
  </div>
</a>
```

The "leading headline" is the first redFlag insight's headline, falling back to first watchout, falling back to first verified.

---

## Section 6: Q-DETAIL PANELS (accordion)

**File target:** Rewrites existing `buildQDetail` in same file. Each Q-detail has the same structure.

**HTML shape (per Q-detail):**

```html
<section class="q-detail" id="q1-detail" data-question="1">
  <div class="q-detail-eyebrow">Q1</div>
  <h2 class="q-detail-title">Does the seller actually own this?</h2>
  <p class="q-detail-answer">1 critical concern, 1 watchout, 1 verified.</p>

  <!-- NARRATIVE BAND (top of detail, before per-insight rows) -->
  <div class="q-narrative">
    <h3>The Ownership Story</h3>
    <p>This plot is owned by Krushnachandra Barajena and 4 co-owners (Subhra, Gaur, Sunita, Bikram). The last recorded mutation was in 2018. Your seller claims the name "Mohapatra", which doesn't match the Bhulekh record — and the seller is in Cuttack while the plot is in Khordha. This pattern matches the Malipada Impersonation scam (Pattern 3) seen in 2020–2023. All 5 co-owners must sign for transfer.</p>
  </div>

  <!-- OWNER CARD (identity field display, includes caste) -->
  <div class="owner-card">
    <div class="oc-row"><span class="oc-l">Owner</span><span class="oc-v">Krushnachandra Barajena <span class="oc-odia">କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା</span></span></div>
    <div class="oc-row"><span class="oc-l">Father</span><span class="oc-v">Pratima Chandra Barajena</span></div>
    <div class="oc-row"><span class="oc-l">Category</span><span class="oc-v">SC</span></div>
    <div class="oc-row"><span class="oc-l">Address</span><span class="oc-v">At-Patia, Dist-Khordha</span></div>
    <div class="oc-row"><span class="oc-l">Co-owners</span><span class="oc-v">4 (Subhra, Gaur, Sunita, Bikram)</span></div>
    <div class="oc-trust-strip">
      <span>📜 bhulekh.ori.nic.in</span><span>⏱ 14:23</span><span>🔒 7a3f9b2c</span><span>🔧 v3.2</span>
    </div>
  </div>

  <!-- INSIGHT ROWS (per insight, sorted by severity) -->
  <ul class="insight-list">
    <li class="insight-row" data-severity="critical_concern">
      <div class="ir-headline">
        <span class="ir-icon">🛑</span>
        <span>Name does not match the Bhulekh record</span>
      </div>
      <div class="ir-rule">Rule: <code>ROR-INS-024</code> · Pattern 3 (Malipada Impersonation)</div>
      <p class="ir-body">The official Bhulekh RoR shows the owner as "Krushnachandra Barajena", but your seller claimed "Mohapatra". This is a significant discrepancy.</p>
      <p class="ir-action">→ Ask seller: "Why does your name differ from the Bhulekh record? Can you produce a power of attorney or sale deed linking you to this plot?"</p>
      <details class="ir-disclosure">
        <summary>How we checked this</summary>
        <ul>
          <li><b>What we checked:</b> Bhulekh RoR page 1, owner field (ସ୍ୱାର୍ଥୀ)</li>
          <li><b>How to verify:</b> Visit bhulekh.odisha.gov.in, search by plot 309</li>
          <li><b>Limits:</b> Name matching uses phonetic similarity — may miss rare transliteration variants</li>
          <li><b>Evidence strength:</b> selected_plot_anchor (high)</li>
          <li><b>Parser confidence:</b> 85%</li>
          <li><b>Source:</b> <a href="...">bhulekh.ori.nic.in/SRoRFront_Uni.aspx?...</a></li>
        </ul>
      </details>
    </li>
    <!-- More insight rows… -->
  </ul>
</section>
```

**Q2 specifically has the §22 transferability check** at the bottom of the detail panel (after the buildability story narrative):

```html
<div class="transferability-check" data-applies="true">
  <h4>Transferability Check</h4>
  <p>RoR category: <b>SC</b></p>
  <p>Odisha Land Reforms Act §22 (as amended) restricts transfer of agricultural land by tribal/Scheduled Caste tenure holders without District Collector approval in some tehsils. Verify with the tehsildar before purchase.</p>
  <div class="oc-trust-strip">
    <span>📜 bhulekh.ori.nic.in</span><span>⏱ 14:23</span><span>🔒 7a3f9b2c</span>
  </div>
</div>
```

For General: `<div class="transferability-check" data-applies="false">` with "No §22 transferability restrictions apply."

---

## Section 7: MUTATION TIMELINE (S2)

**File target:** New `buildMutationTimeline(mutationRecords, ecGap)` function.

**HTML shape:**

```html
<section class="mutation-timeline">
  <h2>Mutation Timeline</h2>
  <ol class="mt-rail">
    <li class="mt-entry" data-type="mutation">
      <span class="mt-year">2018</span>
      <span class="mt-dot"></span>
      <span class="mt-text">Mutation #145/2018 — Sale to Krushnachandra Barajena</span>
      <span class="mt-source">📜 Bhulekh back page · 🔒 hash · 🔧 v3.2</span>
    </li>
    <li class="mt-entry" data-type="encumbrance">
      <span class="mt-year">2020</span>
      <span class="mt-dot"></span>
      <span class="mt-text">Mortgage to SBI — ₹12,00,000 (active per CERSAI)</span>
      <span class="mt-source">📜 Bhulekh back page + cersai.gov.in · Trust: 90%</span>
    </li>
    <li class="mt-entry" data-type="mutation">
      <span class="mt-year">2022</span>
      <span class="mt-dot"></span>
      <span class="mt-text">Mutation published — no new transfer</span>
      <span class="mt-source">📜 Bhulekh back page · Trust: 75%</span>
    </li>
    <li class="mt-entry" data-type="gap">
      <span class="mt-year">2024</span>
      <span class="mt-dot"></span>
      <span class="mt-text">⏳ Pending — your proposed transaction</span>
    </li>
    <li class="mt-entry" data-type="gap">
      <span class="mt-year">??</span>
      <span class="mt-dot"></span>
      <span class="mt-text">⚠ Gap: no post-2022 EC verification</span>
      <span class="mt-source">📜 EC gap · Trust: 0% — manual verification required</span>
    </li>
  </ol>
</section>
```

---

## Verdict tier mapping (replaces ₹-driven tiers)

| Insight composition | Verdict tier | Headline |
|---|---|---|
| ≥1 fired CRITICAL pattern | `critical_concern` | "Critical Concern — [pattern name] detected" |
| ≥1 redFlag (non-pattern) | `watchout` | "Important — [leading insight name]" |
| All matched, no gaps | `verified` | "Verified — what we checked, what to confirm" |
| Any source unavailable | `gap` | "Source Observation — [what we couldn't fetch]" |

The tier is set by the most severe fired insight. The headline references that insight's pattern name when applicable.

---

## Caste display (locked decision)

Two surfaces:

1. **Owner card row** in Q1 detail panel: `<div class="oc-row"><span class="oc-l">Category</span><span class="oc-v">SC</span></div>` — alongside Father, Address, etc.
2. **§22 transferability check** at the bottom of Q2 detail panel, conditional on `category in ['SC', 'ST']`.

When `caste` is null/unknown in source, owner card row shows "—" and no §22 block appears.

When `category === 'General'`, the §22 block appears with `data-applies="false"` and the "no restrictions" copy.

---

## Files to touch (initial Sprint 1)

1. [agents/consumer-report-writer/src/index.ts](agents/consumer-report-writer/src/index.ts) — hero, Q-grid rewrite, Q-detail rewrite, narrative bands, trust strip universal pattern
2. New file: `agents/consumer-report-writer/src/components/tested-patterns.ts` — pattern definitions + `buildTestedPatternsPanel()`
3. New file: `agents/consumer-report-writer/src/components/source-trust-strip.ts` — `buildSourceTrustStrip()` + inline `buildFactTrustStrip()`
4. [agents/consumer-report-writer/src/index.test.ts](agents/consumer-report-writer/src/index.test.ts) — golden-path test for new structure
5. CSS updates (Tailwind + inline): `hero-strip`, `tested-patterns`, `source-trust-strip`, `q-narrative`, `owner-card`, `insight-row`, `transferability-check`, `mutation-timeline`

---

## Sprint mapping (final, with effort)

**Sprint 1 (~20h):**
- T1 Tested Patterns Panel — 4h
- T2 Source Trust Strip (universal) — 6h
- T3 6-Q Grid with severity tallies — 4h
- T4 Caste: owner block + §22 — 3h
- T10 Surface V1.2 fields — 6h
- T11 Verify B6/A8 CERSAI stub — 1h

**Sprint 2 (~32h):**
- T5 Insight rows with raw Odia + provenance — 4h
- T6 Hero rewrite (drop ₹) — 4h
- T7 Mutation Timeline — 4h
- T12 Update golden-path corpus with V1.2 fixtures — 4h
- T13 V1.2 path E2E test — 4h
- T14 Neighbour names + chauhaddi overlay on plot diagram — ~20h
- T15 Move plot diagram to Q1/Q2 anchor — 3h

**Sprint 3 (~8h):**
- T8 4 narrative paragraphs — 4h
- T9 Mobile + print polish — 4h

**Total: ~60h**

**Recommended starting point:** T1 (Tested Patterns Panel) and T10 (V1.2 field surfacing) in parallel. T1 is the trust moat; T10 is the largest quick win (7 hidden fields).
