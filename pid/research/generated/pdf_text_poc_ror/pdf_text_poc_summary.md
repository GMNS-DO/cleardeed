# PDF Text/OCR POC Summary

Generated: 2026-05-25T21:56:41.516Z

Purpose: PDF text/OCR triage for PID evidence promotion. This does not create final risk findings.

## Environment

| Capability | Available |
|---|---|
| pdftotext CLI | no |
| tesseract CLI | no |
| tesseract.js | yes |
| sips | yes |

## Status Counts

| Status | Count |
|---|---:|
| ocr_text_found | 1 |
| image_pdf_ocr_weak | 2 |
| image_pdf_ocr_pending | 3 |

## Files

| File | Field | DCT images | Raw text chars | OCR chars | Triage |
|---|---|---:|---:|---:|---|
| project-1878-doc-235560-plotrorid.pdf | plotRorId | 2 | 26 | 1391 | ocr_text_found |
| project-1613-doc-163323-plotrorid.pdf | plotRorId | 96 | 8 | 0 | image_pdf_ocr_weak |
| project-1920-doc-241019-plotrorid.pdf | plotRorId | 414 | 7623 | 100 | image_pdf_ocr_weak |
| project-1876-doc-234960-plotrorid.pdf | plotRorId | 2 | 8 | 0 | image_pdf_ocr_pending |
| project-1221-doc-115176-plotrorid.pdf | plotRorId | 4 | 18 | 0 | image_pdf_ocr_pending |
| project-1930-doc-241582-plotrorid.pdf | plotRorId | 2 | 44 | 0 | image_pdf_ocr_pending |

## Interpretation

- `image_pdf_ocr_weak` means the PDF is image-based and OCR returned low or noisy text in this first pass.
- `image_pdf_ocr_pending` means the PDF is image-based and OCR was not attempted in this capped run.
- Strong fraud/dispute labels still require better OCR or manual review of the linked evidence.
