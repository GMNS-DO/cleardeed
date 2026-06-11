# PDF Text/OCR POC Summary

Generated: 2026-05-25T21:56:00.715Z

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
| image_pdf_ocr_weak | 1 |
| ocr_text_found | 1 |
| image_pdf_ocr_pending | 6 |

## Files

| File | Field | DCT images | Raw text chars | OCR chars | Triage |
|---|---|---:|---:|---:|---|
| project-1878-doc-235559-plotecid.pdf | plotEcId | 6 | 313 | 3334 | image_pdf_ocr_weak |
| project-1878-doc-235560-plotrorid.pdf | plotRorId | 2 | 26 | 1391 | ocr_text_found |
| project-1878-doc-250157-poaid.pdf | poaId | 24 | 12 | 0 | image_pdf_ocr_pending |
| project-1850-doc-252018-plotecid.pdf | plotEcId | 261 | 0 | 0 | image_pdf_ocr_pending |
| project-1850-doc-252020-plotecid.pdf | plotEcId | 261 | 0 | 0 | image_pdf_ocr_pending |
| project-1850-doc-252021-plotecid.pdf | plotEcId | 261 | 0 | 0 | image_pdf_ocr_pending |
| project-1850-doc-252022-plotecid.pdf | plotEcId | 261 | 0 | 0 | image_pdf_ocr_pending |
| project-1613-doc-163322-plotecid.pdf | plotEcId | 8 | 8 | 0 | image_pdf_ocr_pending |

## Interpretation

- `image_pdf_ocr_weak` means the PDF is image-based and OCR returned low or noisy text in this first pass.
- `image_pdf_ocr_pending` means the PDF is image-based and OCR was not attempted in this capped run.
- Strong fraud/dispute labels still require better OCR or manual review of the linked evidence.
