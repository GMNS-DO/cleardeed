# PI-3 — Trust Layer (Guaranteed Tier) — Implementation Plan

## Current state (verified 2026-07-14)

**Already built (legacy Agent HTML layer):**
- `agents/consumer-report-writer/src/index.ts` lines 5651–5662: `verifyLinkForSource()` produces `<a class="verify-link">Verify yourself on <source label> →</a>` anchors.
- `buildQDetail()` lines 2370–2420 renders provenance blocks (`q-detail-provenance-source`, `q-detail-provenance-time`, `q-detail-verify`) for every section.
- `renderTrustStrip()` line 2331 renders sub-finding chips with per-rule verify URLs for CRITICAL/HIGH insights.
- `buildFeedbackFooter()` line 2582 renders the 30/90/180/365-day follow-up footer.
- Tests: 7 "Verify yourself" tests in `index.test.ts` lines 1370–1520 — cover per-section links, NO-GO source suppression, and IGR registry links.

**NOT yet built (React BuyerLayer):**
- No `ProvenanceButton` / `SourceLinkResolver` components exist anywhere in `apps/web/src/`.
- `VerdictCard.tsx` takes no `sourceUrl`, `source`, `fetchedAt` props — no provenance slot.
- `QuestionPanel.tsx` has `sourceSummary` (free-text) but no per-source link.
- `BuyerLayer.tsx` is hard-coded mock data (no real source plumbing from the orchestrator output).
- The React shell currently renders the legacy HTML blob via `dangerouslySetInnerHTML` (which DOES have verify links). BuyerLayer mock rendering is a placeholder.

**Pricing:**
- `pricing.ts` has the four tiers including `guaranteed` ₹4,999 — includes "advocate co-sign + 18-month correctness guarantee" text but no guarantee-consent field.
- `checkout/route.ts` stores `tier` in `session_data` — no `guarantee_accepted` flag, no `lawyer_id`.

**Guarantee tier plumbing:**
- `reports.lawyer_id`, `reports.signed_at`, `reports.guarantee_accepted_at` columns — not yet in DB.
- `lawyers` table — does not exist.
- Admin advocate onboarding — does not exist.

**Lawyer co-sign plumbing:**
- No DB columns, no admin, no signature rendering in report.

## Plan

### T1 — Trust 1: Provenance per claim — "Verify yourself" button + SourceLinkResolver on CRITICAL/HIGH insights (React shell)

**Scope:**
- Build `ProvenanceButton` + `SourceLinkResolver` React components.
- Wire into `VerdictCard` (new `sourceUrl?`, `sourceLabel?`, `fetchedAt?` props) so every CRITICAL/HIGH insight card gets a "Verify yourself ↗" link.
- Wire into `QuestionPanel` (same props).
- `SourceLinkResolver` utility: stateless map from `(source key, sourceStatus)` → `{url, label, fallbackLabel}`. Handles NO-GO sources by showing a manual-verification action item instead of a broken link.

**Files:**
- `apps/web/src/app/report/[id]/components/ProvenanceButton.tsx` (new) — "Verify yourself ↗" link button with tooltip showing `fetchedAt`. Accessibility: rel="noopener noreferrer" + aria-label.
- `apps/web/src/app/report/[id]/components/SourceLinkResolver.ts` (new) — resolver map + helper.
- `apps/web/src/app/report/[id]/components/VerdictCard.tsx` — add optional provenance props, render `ProvenanceButton` for `redFlag`/`watchout` severities (skip for `positive`/`info`).
- `apps/web/src/app/report/[id]/components/QuestionPanel.tsx` — add provenance props, render `ProvenanceButton` when `verdict` is `redFlag`/`watchout`/`partial`.
- `apps/web/src/app/report/[id]/components/__tests__/VerdictCard.test.tsx` (new) — test CRITICAL card renders button, sourceStatus=manual_required falls back to action item, positive card omits button.
- `apps/web/src/app/report/[id]/components/__tests__/ProvenanceButton.test.tsx` (new) — test resolver outputs correct URL per source key.

**SourceLinkResolver contract (planned):**
```
key                    url (when success/partial)                        label
"bhulekh"             → https://bhulekh.ori.nic.in/...view-mode=...     "Bhulekh RoR"
"bhunaksha"           → https://mapserver.odisha4kgeo.in/...            "Bhunaksha plot"
"ecourts"             → https://services.ecourts.gov.in/...             "eCourts case search"
"high-court"          → https://hcservices.ecourts.gov.in/...           "Odisha High Court"
"drt"                 → https://cis.drt.gov.in/drtlive/...              "DRT case search"
"rccms"               → https://ccms.nic.in/...                         "RCCMS (manual — ask your lawyer)"
"igr-ec"              → https://igrodisha.gov.in/...                    "IGR EC portal"
"igr-bmv"             → https://regis.odisha.gov.in/Benchmark/BMV...   "IGR BMV"
"circle-rate"         → https://regis.odisha.gov.in/Benchmark/BMV...   "IGR circle rate"
"nominatim"           → https://nominatim.openstreetmap.org/...         "OpenStreetMap"
"bda-zoning"          → https://bda.gov.in/...                          "BDA Master Plan"
"bhuvan-flood"        → https://bhuvan-ras2.nrsc.gov.in/...             "Bhuvan flood frequency"
* NO_GO / not_run    → null → VerdictCard shows "Ask your lawyer to verify manually at <portal>" instead of a link.
```

**Success criteria:**
- `VerdictCard` with `severity="redFlag"` + `sourceUrl` renders `ProvenanceButton` pointing to that URL.
- `severity="positive"` does NOT render a button (no unnecessary noise).
- Source status=NO_GO renders "Manual verification required" action item text, not a broken link.
- Tests green.

---

### T2 — Trust 2: Guarantee tier — checkout consent + report footer guarantee terms

**Scope:**
- Add `reports.guarantee_accepted_at`, `reports.lawyer_id`, `reports.signed_at` columns.
- Extend `/api/checkout` to accept `guaranteeAccepted` boolean + store in session.
- Add `guarantee.consentLabel`, `guarantee.termsUrl`, `guarantee.termsText` constants to `pricing.ts`.
- Render guarantee terms in the report footer (below existing "consult a lawyer" line).
- Render lawyer signature block in report footer when `lawyer_id` + `signed_at` are set.

**Files:**
- `infra/supabase/migrations/020_guarantee_lawyer_columns.sql` — adds columns.
- `apps/web/src/lib/pricing.ts` — add `guarantee.termsUrl`, `guarantee.consentLabel`, `guarantee.termsSummary` constants.
- `apps/web/src/app/api/checkout/route.ts` — accept `guaranteeAccepted?` + `lawyerId?` in body, store in session.
- `agents/consumer-report-writer/src/renderer/footer.ts` (or extend existing) — `buildGuaranteeFooter()` that renders terms text + lawyer signature block.
- `agents/consumer-report-writer/src/index.ts` — call `buildGuaranteeFooter` from the HTML layer buyer output.
- React BuyerLayer equivalent — `ReportFooter.tsx` component (or extend `FinancialExposureSummary` for the React path; long-term target is React, short-term is HTML layer parity).

**Report footer structure (both layers):**
```
─────────────────────────────────────────────
🛡️ 18-month correctness guarantee
   This report carries a correctness guarantee for "verified clear" claims only.
   If a claim labeled "verified clear" is proven wrong within 18 months of
   report generation, you are entitled to a full refund plus complimentary
   panel-lawyer review. Full terms: <guarantee.termsUrl>

   Signed by: [Advocate Name] on <date>  (only when lawyer_id + signed_at set)

   ⚠️  Consult a lawyer before transacting.
   ClearDeed is an information aggregator. We do not certify ownership,
   guarantee absence of fraud, or recommend transactions.
─────────────────────────────────────────────
```

**Success criteria:**
- Guaranteed tier checkout stores `guarantee_accepted: true` in session.
- `mark_report_paid` RPC sets `guarantee_accepted_at` on the report row.
- Report footer renders guarantee terms text + lawyer signature block when set.
- Free / Standard / Verified tiers do NOT render the guarantee section.

---

### T3 — Trust 3: Lawyer co-sign — advocate selection in checkout + signature block

**Scope:**
- Create `lawyers` table (Supabase) with minimal columns: `id`, `name`, `firm`, `email`, `phone`, `license_number`, `photo_url`, `is_panel`, `created_at`.
- Migrate `reports` to add `lawyer_id` FK + `signed_at` + `lawyer_signature_url`.
- Checkout: when `tier === "guaranteed"`, present advocate-selection dropdown (populated from `lawyers` table) or "I will provide my own lawyer" fallback. Store `lawyerId` in checkout session.
- After payment: webhook writes `lawyer_id` onto report row (same `mark_report_paid` RPC).
- Render signature block in report footer (T2 covers the rendering; T3 adds the data flow).
- Admin: `/admin/lawyers` page (fail-closed behind `ADMIN_VIEW_TOKEN`) — CRUD advocates.

**Files:**
- `infra/supabase/migrations/021_lawyer_table.sql` — creates `lawyers` table + columns on `reports`.
- `apps/web/src/app/admin/lawyers/page.tsx` — advocate CRUD (fail-closed).
- `apps/web/src/app/api/lawyers/route.ts` — GET list + POST create.
- `apps/web/src/app/api/admin/lawyers/[id]/route.ts` — PUT update, DELETE.
- `apps/web/src/app/api/report/create/route.ts` — when tier=guaranteed, render lawyer selection in the frontend form (or the form already calls /api/order with tier — add a lawyer dropdown to the order form).
- Seed script: `scripts/seed/lawyers.ts` — seeds 2-3 panel advocates as fixtures.

**Signing flow (manual, CLAUDE.md approved):**
- Buyer selects advocate at checkout.
- After payment, report is generated.
- ClearDeed emails the advocate a PDF + a "sign and return" link.
- Advocate returns signed PDF (uploaded to Supabase storage).
- `signed_at` + `lawyer_signature_url` are written to the report row.
- Next report render shows the signature block.

**Success criteria:**
- `lawyers` table exists with ≥1 seeded panel advocate.
- Checkout with `tier=guaranteed` + `lawyerId=panel-advocate-1` stores the selection.
- Report row has `lawyer_id`, `signed_at`, `lawyer_signature_url` populated after signing.
- Report footer renders signature block when the fields are set.
- Admin lawyers page is fail-closed (no token → 401).

---

### T4 — End-state check

**Scope:**
- Provenance: every CRITICAL/HIGH insight card rendered in the React buyer layer has a `ProvenanceButton` that resolves to a real URL. For NO_GO sources (eCourts/HC/DRT/RCCMS), the button shows manual-verification copy instead of a dead link.
- Guaranteed tier: end-to-end flow — checkout with `tier=guaranteed` → Razorpay payment → `guarantee_accepted_at` set on report → report footer renders guarantee terms.
- Lawyer co-sign: advocate selection in checkout, seed advocates loaded, signature block renders.
- `pnpm test` green for new tests.

**Checklist:**
- [ ] `VerdictCard` renders `ProvenanceButton` on CRITICAL/HIGH cards
- [ ] `VerdictCard` skips button on `positive`/`info` cards
- [ ] `SourceLinkResolver` returns correct URLs for every source key (bhulekh, bhunaksha, ecourts, etc.)
- [ ] NO_GO sources render "Manual verification required" instead of a link
- [ ] `ProvenanceButton` test suite green (≥3 tests)
- [ ] Checkout accepts `guaranteeAccepted` + `lawyerId`
- [ ] `reports.guarantee_accepted_at` populated by webhook
- [ ] Report footer renders guarantee terms when `paid_tier === "guaranteed"`
- [ ] Report footer renders lawyer signature block when `lawyer_id` + `signed_at` set
- [ ] `lawyers` table seeded with ≥1 panel advocate
- [ ] Admin `/admin/lawyers` fail-closed
- [ ] `pnpm test` passes (no regressions)
- [ ] `pnpm plan:complete PI-3-T1/T2/T3/T4` marks all four tasks complete
