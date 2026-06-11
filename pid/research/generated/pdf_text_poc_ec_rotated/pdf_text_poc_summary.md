# PDF Text/OCR POC Summary

Generated: 2026-05-25T22:08:32.024Z

Purpose: PDF text/OCR triage for PID evidence promotion. This does not create final risk findings.

## Environment

| Capability | Available |
|---|---|
| pdftotext CLI | no |
| tesseract CLI | no |
| tesseract.js | yes |
| sips | yes |
| sharp | yes |

## Status Counts

| Status | Count |
|---|---:|
| ocr_text_found | 1 |
| image_pdf_ocr_pending | 2 |

## Files

| File | Field | DCT images | Raw text chars | OCR chars | Hint type | Hints | Triage |
|---|---|---:|---:|---:|---|---:|---|
| project-1878-doc-235559-plotecid.pdf | plotEcId | 6 | 313 | 2306 | encumbrance_certificate | 7 | ocr_text_found |
| project-1850-doc-252018-plotecid.pdf | plotEcId | 261 | 0 | 0 |  | 0 | image_pdf_ocr_pending |
| project-1850-doc-252020-plotecid.pdf | plotEcId | 261 | 0 | 0 |  | 0 | image_pdf_ocr_pending |

## Interpretation

- `image_pdf_ocr_weak` means the PDF is image-based and OCR returned low or noisy text in this first pass.
- `image_pdf_ocr_pending` means the PDF is image-based and OCR was not attempted in this capped run.
- Strong fraud/dispute labels still require better OCR or manual review of the linked evidence.
