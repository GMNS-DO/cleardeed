# PDF Text/OCR POC

Date: 2026-05-26

Purpose: test whether the ORERA evidence PDFs can be promoted from metadata-only candidate signals into content-backed evidence facts.

## Why This Matters

The first insight POC can already identify candidate signals from ORERA metadata: POA flags, sale-deed gaps, owner-share rows, title-flow text, EC/RoR file IDs, and collected PDF paths.

Stronger fraud/dispute/issue patterns require the contents of the PDFs:

- RoR owner rows, kisam, remarks, case references
- EC transaction chain, mortgages, court orders, repeated transfers
- POA executant/holder/scope/date/revocation clues
- sale deed parties and property schedule
- Revenue/SIA notice villages, plots, and acquisition purpose

## Script

```bash
node pid/analysis/pdf-text-poc.mjs --limit=8 --ocr-limit=2
node pid/analysis/pdf-text-poc.mjs --field=plotRorId --limit=6 --ocr-limit=3 --out-dir=pid/research/generated/pdf_text_poc_ror
node pid/analysis/pdf-text-poc.mjs --field=plotRorId --limit=4 --ocr-limit=4 --page-limit=2 --rotations=0,90,180,270 --out-dir=pid/research/generated/pdf_text_poc_ror_rotated
node pid/analysis/pdf-text-poc.mjs --field=plotEcId --limit=3 --ocr-limit=3 --page-limit=2 --rotations=0,90,180,270 --out-dir=pid/research/generated/pdf_text_poc_ec_rotated
```

The script:

- reads candidate PDF references from `pid/research/generated/orera_50_pattern_candidates.json`
- detects whether PDFs have usable text or embedded image streams
- extracts embedded JPEG page images for OCR
- can scan rotation variants with `--rotations=0,90,180,270`
- uses `sharp` for grayscale/normalization/rotation preprocessing
- uses `tesseract.js` where available
- extracts lightweight content hints from OCR text for EC/RoR review
- writes per-file JSON and a summary markdown

## Outputs

```text
pid/research/generated/pdf_text_poc/pdf_text_poc_summary.json
pid/research/generated/pdf_text_poc/pdf_text_poc_summary.md
pid/research/generated/pdf_text_poc/files/

pid/research/generated/pdf_text_poc_ror/pdf_text_poc_summary.json
pid/research/generated/pdf_text_poc_ror/pdf_text_poc_summary.md
pid/research/generated/pdf_text_poc_ror/files/

pid/research/generated/pdf_text_poc_ror_rotated/pdf_text_poc_summary.json
pid/research/generated/pdf_text_poc_ror_rotated/pdf_text_poc_summary.md
pid/research/generated/pdf_text_poc_ror_rotated/files/

pid/research/generated/pdf_text_poc_ec_rotated/pdf_text_poc_summary.json
pid/research/generated/pdf_text_poc_ec_rotated/pdf_text_poc_summary.md
pid/research/generated/pdf_text_poc_ec_rotated/files/
```

## Environment Findings

| Capability | Status |
|---|---|
| `pdftotext` CLI | not installed |
| `tesseract` CLI | not installed |
| `pdfinfo`/Poppler tools | not installed |
| `mutool` | not installed |
| `qpdf` | not installed |
| `sips` | available |
| `sharp` | available |
| `tesseract.js` | available through Node dependency |

## General 8-PDF Pass

| Status | Count |
|---|---:|
| `ocr_text_found` | 1 |
| `image_pdf_ocr_weak` | 1 |
| `image_pdf_ocr_pending` | 6 |

Interpretation:

- ORERA evidence PDFs are mostly image-based, not normal text-layer PDFs.
- Raw PDF string extraction is not enough.
- `tesseract.js` can extract useful text from at least some documents.
- EC PDFs may need page/orientation/language preprocessing before OCR is reliable.

## RoR-Focused Pass

| Status | Count |
|---|---:|
| `ocr_text_found` | 1 |
| `image_pdf_ocr_weak` | 2 |
| `image_pdf_ocr_pending` | 3 |

The first RoR OCR sample produced useful text fragments including:

- "GOVERNMENT OF ODISHA"
- "Office of the Tahasildar, Jatni, Khordha"
- "CERTIFIED COPY OF ROR"
- case/reference style text such as `O.L.R. 8 (A) Case No.3484/2024`
- plot/RoR schedule text mixed with Odia OCR noise

This is enough to prove the extraction route, but not enough for final automated legal labeling.

## Rotated/Normalized RoR Pass

Command scanned up to 2 large embedded images per PDF and rotations `0,90,180,270`.

| Status | Count |
|---|---:|
| `ocr_text_found` | 3 |
| `image_pdf_ocr_pending` | 1 |

Useful detail:

- 3 of 4 RoR samples crossed the usable OCR threshold after rotation/normalization.
- One usable RoR needed `rotation=90`.
- One RoR still had no large embedded image candidate in the first extracted streams, suggesting tiled/fragmented PDF structure.

## Rotated/Normalized EC Pass

Command scanned up to 2 large embedded images per PDF and rotations `0,90,180,270`.

| Status | Count |
|---|---:|
| `ocr_text_found` | 1 |
| `image_pdf_ocr_pending` | 2 |

The successful EC sample produced structured content hints:

```json
{
  "document_type": "encumbrance_certificate",
  "application_no": "2024112004737",
  "certificate_no": "EC1122024004216",
  "applicant_name": "HEMANTA KUMAR PRADHAN",
  "owner_name_as_application": "KISHORE MOHAN CHAMPATI",
  "search_period": "20 years 01-JAN-1975 to 31-DEC-1994",
  "phrase": "no_acts_or_encumbrance_found_phrase"
}
```

This is the first content-level bridge from a raw PDF to reviewable EC facts. It is still not a final title conclusion: the OCR output and extracted hints need review, and the full EC period/page set must be checked.

## POC Conclusion

PDF content extraction is feasible, but the next step should not be plain text extraction alone. It should be an OCR pipeline with:

1. page-image extraction for all embedded images, not just page 1
2. orientation detection/rotation
3. English + Odia OCR language support
4. document-type-specific parsers for RoR, EC, POA, sale deed
5. confidence scoring per field, not just per document
6. human review before promoting candidate signals into fraud/dispute findings

## Immediate Pattern Impact

Current candidate cards should remain metadata-level:

- `metadata_high_content_pending` where EC/RoR PDF exists but text is not parsed
- `metadata_high_review_required` where POA/sale-deed/title-flow metadata suggests chain review
- no final "fraud", "defect", or "dispute" label without OCR/manual confirmation

The RoR OCR success gives us the next concrete path: extract owner/kisam/case-reference fields from RoR PDFs and compare them against ORERA owner rows and buyer-provided RoR details.
