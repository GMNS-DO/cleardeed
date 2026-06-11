# PDF Text/OCR POC Summary

Generated: 2026-05-25T22:10:17.628Z

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
| ocr_text_found | 3 |
| image_pdf_ocr_pending | 1 |

## Files

| File | Field | DCT images | Raw text chars | OCR chars | Hint type | Hints | Triage |
|---|---|---:|---:|---:|---|---:|---|
| project-1878-doc-235560-plotrorid.pdf | plotRorId | 2 | 26 | 1396 | record_of_rights | 5 | ocr_text_found |
| project-1613-doc-163323-plotrorid.pdf | plotRorId | 96 | 8 | 0 | record_of_rights | 0 | image_pdf_ocr_pending |
| project-1920-doc-241019-plotrorid.pdf | plotRorId | 414 | 7623 | 868 | record_of_rights | 0 | ocr_text_found |
| project-1876-doc-234960-plotrorid.pdf | plotRorId | 2 | 8 | 833 | record_of_rights | 0 | ocr_text_found |

## Interpretation

- `image_pdf_ocr_weak` means the PDF is image-based and OCR returned low or noisy text in this first pass.
- `image_pdf_ocr_pending` means the PDF is image-based and OCR was not attempted in this capped run.
- Strong fraud/dispute labels still require better OCR or manual review of the linked evidence.
