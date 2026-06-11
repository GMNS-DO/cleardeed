# Phase 0 Artifact Parse Notes

Date: 2026-05-25

Purpose: record what has actually been parsed from Phase 0 raw artifacts, what is only a candidate signal, and what remains blocked by extraction tooling. These notes are corpus evidence preparation only; they are not product integration work.

## Parse Status Summary

| Bucket | Artifact(s) | Current parse result | Evidence readiness |
|---|---|---|---|
| Regulatory/acquisition | Odisha Revenue land acquisition HTML | Parsed page sections and high-signal notice rows | Ready for reviewer source-feasibility review; needs individual notice PDFs for case-level labels |
| Regulatory/acquisition | Odisha Revenue SIA 4(1) HTML | Parsed Khordha/Khurda SIA rows with dates, letter numbers, areas, villages, and project purpose | Ready for reviewer source-feasibility review; strong E-02 source candidate |
| RERA | ORERA home HTML | Parsed available public search/navigation modes | Source-feasibility only; needs actual project/promoter/complaint examples |
| DRT/DRAT | DRT Cuttack cause-list HTML files | Parsed case numbers and party pairs for bank recovery/SARFAESI-style matters | Ready for reviewer source-feasibility review; not property-specific until order/security text is linked |
| High Court PDFs | 8 Orissa High Court PDFs | Raw artifacts downloaded, but local tools did not extract usable text | Pending PDF text/OCR tooling |
| DRT PDF | DRT mortgage release order PDF | Raw artifact downloaded, but local tools did not extract usable text beyond metadata | Pending PDF text/OCR tooling |
| Bhulekh/revenue local PDFs | 7 local PDFs | Earlier `strings`/`textutil` checks indicate image-heavy or non-extractable content | Pending OCR/PDF tooling |

## Parsed Source Facts

### SEED-REG-002: Odisha Revenue Land Acquisition Page

Source URL: https://revenue.odisha.gov.in/en/communication/land-acquisition

Parsed sections:
- Notification on declaration of Land Acquisition Officer
- SIA Notification
- Withdrawal Notification

High-signal rows observed:
- 16/08/2025, letter 30964: LARRMS/Bhuarjan portal for Yadast preparation, award of land-acquisition compensation, and rent abatement module.
- 02/08/2025, letter 28866: Land acquisition by IDCO for eventual allotment of land to industries.
- 26/03/2025, letter 11763: GST non-applicability on compensation value paid for acquisition of land and structural work.
- 24/12/2024, letter 45441: Extension of validity period for declaration under section 19(7) of RFCTLARR Act, 2013.
- 29/04/2023, letter RDM-LAA-CLRFIC-0001-2017-15362: Compensation guideline for acquisition of FRA land.
- 31/10/2022, letter RDM-LAA-POLICY-0001-2022-36983: Return of unutilized acquired land measuring Ac.206.685 dec to original land owners.
- 22/03/2022, letter RDM-LAA-MISC-0027-2014-9204: Instruction on possession of acquired land versus tendering compensation under RFCTLARR Act, 2013.

Theme implication:
- Supports E-02 acquisition/corridor/compensation risk as a source class.
- Does not prove a plot-specific issue unless a notice, village/plot schedule, or affected landowner record is linked.

### SEED-REG-003: Odisha Revenue SIA 4(1) Notification Page

Source URL: https://revenue.odisha.gov.in/en/Communication/sia-notification/4-1-notification

Khordha/Khurda rows parsed:
- 05/02/2026, letter 5419: Ac. 4.306 in village Medini, Khordha district, for Rajua diversion wire project.
- 02/02/2026, letter 4791: Ac. 1.026 in Kurumapada village, Khurda district, for Rajua Diversion Ware Project.
- 22/01/2026, letter 3412: Ac. 2.868 of Kurumapada village, Khurda district, for Rajua diversion wire.
- 22/01/2026, letter 3418: Ac. 3.177 of Sadheigada village, Khurda district, for Rajua diversion wire.
- 22/01/2026, letter 3424: Ac. 3.892 of Saradhapur village, Khurda district, for Rajua diversion wire.
- 22/01/2026, letter 3466: Ac. 2.224 of Dhabalpur, Khurda district, for Rajua diversion wire.
- 15/01/2026, letter 2001: Ac. 2.44 in Sadheigad village of Khordha tahasil, Khordha district, for Rajua Diversion ware project.

Theme implication:
- Strong source candidate for E-02 acquisition risk and area/village-level SIA notice tracking.
- Needs linked notice PDFs and any land schedule fields before being approved as plot-level evidence.

### SEED-RERA-001: ORERA Home Page

Source URL: https://rera.odisha.gov.in/

Parsed public entry points:
- Registered Projects
- Real Estate Agents
- Project registration
- Agent registration
- Complaint filing
- Public information services

Theme implication:
- Supports source feasibility for E-03 builder/project regulatory risk and F-03 actor/network checks.
- Needs actual project, promoter, agent, or complaint artifacts before any issue theme approval.

### SEED-DRT-001: DRT Cuttack Cause List, 2025-08-29

Source URL: https://cis.drt.gov.in/drtlive/order/Hgenerate_causelist_save1.php?filing_no=MTEvMjkvMDgvMjAyNS0xLWN1dHRhY2s%3D&id=1781901520

Parsed cases:
- OA/423/2025: INDIAN BANK vs M/S LAZZIZ TOWER
- OA/424/2025: UCO BANK vs SMT KUNDALATA MALIK
- OA/425/2025: ICICI BANK LIMITED vs SOURAV MOHANTY
- SA/239/2023 and linked IAs: SRI UMAKANTA ROUT vs CANARA BANK ROUT

Theme implication:
- Supports C-04 recovery/proceeding and F-03 lender/borrower actor checks.
- Does not support C-01 property charge labeling until mortgage/security/property description is linked from order text, CERSAI, deed, or EC.

### SEED-DRT-002: DRT Cuttack Cause List, 2025-08-04

Source URL: https://cis.drt.gov.in/drtlive/order/Hgenerate_causelist_save1.php?filing_no=MTEvMDQvMDgvMjAyNS0xLWN1dHRhY2s%3D&id=1403341620

Parsed cases:
- OA/367/2025: UNION BANK OF INDIA vs M/S SINGHESWAR TRADERS
- OA/369/2025: BANK OF INDIA vs BIJAY KUMAR SINGH
- OA/13/2023 and linked IA: BANK OF BARODA vs MANOJ RANJAN PATTANAIK
- OA/141/2021 and linked IAs: DCB BANK LIMITED vs M/S SAMBANDH FINSERVE PVT. LTD. AND OTHERS
- SA/29/2017: RAMAKRUSHNA SAHOO vs BANK OF INDIA

Theme implication:
- Supports C-04 recovery/proceeding and F-03 lender/borrower actor checks.
- Still needs property/security text before approval as encumbrance evidence.

## Extraction Blockers

The current local environment has `textutil` but not `pdftotext`, `mutool`, `qpdf`, or `exiftool`. `textutil` and `strings` did not provide usable body text for the downloaded High Court PDFs, DRT order PDF, or image-heavy local Bhulekh/revenue PDFs.

Needed before reviewer approval of these PDF candidates:
- A PDF text extractor such as Poppler `pdftotext`, or
- OCR for scanned/image-heavy PDFs, plus
- A normalized artifact-to-text cache with extraction status and confidence.

Until then, those PDFs remain raw artifacts, not parsed evidence.

