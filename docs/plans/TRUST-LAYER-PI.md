# PI-3: Trust Layer — Guaranteed Tier
## Parent plan: docs/plans/MASTER-PLAN.md

## Narrative

Trust is the defensible moat for ClearDeed. Standard-tier reports surface risks. The Guaranteed tier lets buyers act on them with the safety of a refund + panel-lawyer review if any "verified clear" claim is proven wrong within 18 months. PI-3 is the implementation.

## Tasks

### T1 — Provenance per claim (DONE)
- SourceLinkResolver + ProvenanceButton React components.
- VerdictCard + QuestionPanel render provenance for CRITICAL/HIGH (redFlag/watchout).
- Tests: ProvenanceButton.test.tsx (SourceLinkResolver + button + VerdictCard integration).
- HTML-blob path: `renderInsightBlock` emits `data-source`, `data-rule`, source details.
- Known gap: BuyerLayer still uses mock insights (no sourceUrl props passed). Producer: T1 agent.
- *V1.5 follow-up:* Wire `sourceUrl` from mapper → RiskInsight → BuyerLayer VerdictCard props.

### T2 — Guarantee tier plumbing (in_progress)
- `getGuaranteeTerms()` in `apps/web/src/lib/pricing.ts`.
- `/api/checkout` accepts + validates `guaranteeAccepted: true` when tier=guaranteed.
- `reports.guarantee_accepted_at` column (migration 020).
- Webhook sets `guarantee_accepted_at` on paid_tier=guaranteed.
- HTML footer: `buildGuaranteeFooter()` renders when paidTier=guaranteed + guaranteeAcceptedAt set.
- React layer: `ReportFooter.tsx` mirror for the live shell.
- Tests: pricing + checkout 400-gate + ReportFooter + buildGuaranteeFooter.
- Producer: T2 agent.

### T3 — Lawyer co-sign (in_progress)
- `lawyers` table (migration 021 — idempotent; T3 owns the file).
- `reports.lawyer_id`, `reports.lawyer_signature_url`, `reports.signed_at`.
- Admin lawyers CRUD page + `/api/admin/lawyers/*`.
- BuyerLayer: lawyerId selector in checkout + T&C copy ("By signing this report you confirm you have reviewed...").
- Signature block in HTML report footer + React ReportFooter.
- Tests: admin lawyer routes + ReportFooter lawyer block.
- Producer: T3 agent.

### T4 — End-state check (pending)
1. **Provenance links go to real sources.**
   - SourceLinkResolver returns a URL for every known source key (bhulekh, bhunaksha, nominatim, ecourts, high-court, drt, igr-ec, igr-bmv, circle-rate, bda-zoning, bhuvan-flood).
   - RCCMS returns `ccms.nic.in` with manual fallback (correct per NO-GO disposition).
   - Unknown-source returns empty URL + "Ask your lawyer" fallback.
   - VerdictCard renders ProvenanceButton when severity is redFlag/watchout, sourceUrl is set, sourceStatus is not no_go/failed.
   - VerdictCard renders italic "data unavailable" note for no_go/failed statuses.
   - QuestionPanel renders ProvenanceButton when verdict != clear and sourceUrl is set.
   - HTML-blob path: `renderInsightBlock` renders source + evidenceStrength + disclosure.
2. **Guaranteed tier is billable.**
   - `/api/order` accepts tier=guaranteed and returns ₹4,999 in paise.
   - `/api/checkout` requires `guaranteeAccepted=true` when tier=guaranteed (400 otherwise).
   - `/api/webhook/razorpay` sets `paid_tier=guaranteed`, `guarantee_accepted_at=now()`.
   - `decideMetering` has not changed the Gate — free preview users who later upgrade still only get one free report overall.
   - Report footer displays guarantee terms + optional lawyer block.
3. **Lawyer co-sign is wired end-to-end.**
   - BuyerLayer checkout accepts lawyerId (optional; lawyer assigned after payment).
   - T3 admin flow: create lawyer, assign to report, set signature URL + signed_at.
   - Report footer: "Signed by {name}, {firm} on {date}" block.
4. **No "safe to buy" language.**
   - grep for "safe to buy" / "guaranteed clear" (prohibited phrases) in A10 + BuyerLayer.

## Tests

- `pnpm test` must stay green (currently 1,782/1,795 — 13 pre-existing failures independent of PI-3).
- T1 adds ProvenanceButton.test.tsx (SourceLinkResolver + VerdictCard + QuestionPanel).
- T2 adds pricing + checkout gate + buildGuaranteeFooter + ReportFooter.
- T3 adds admin lawyer routes + signature block.
- T4 adds `qa/trust-layer/t4-end-state.test.ts` covering the four acceptance criteria above.

## T4 verification script

Run after T1/T2/T3 are marked complete:

```
pnpm vitest run qa/trust-layer/t4-end-state.test.ts
pnpm vitest run apps/web/src/app/report/[id]/components/__tests__/ProvenanceButton.test.tsx
pnpm vitest run apps/web/src/app/report/[id]/components/__tests__/ReportFooter.test.tsx
```

Grep gates (also part of t4):
- `grep -r "safe to buy" agents/consumer-report-writer/src/ apps/web/src/app/report/` — must produce 0 hits.
- `grep -r "guaranteed clear" agents/consumer-report-writer/src/ apps/web/src/app/report/` — must produce 0 hits (the guarantee is specifically for "verified clear" claims, not "guaranteed clear" — the phrasing difference matters legally).
- `grep -r "ProvenanceButton" apps/web/src/app/report/ | wc -l` — must be >= 2 (VerdictCard + QuestionPanel).
- `grep -r "buildGuaranteeFooter" agents/consumer-report-writer/src/ | wc -l` — must be >= 1.
- `grep -r "lawyer_id" apps/web/src/lib/db.ts | wc -l` — must be >= 1.
