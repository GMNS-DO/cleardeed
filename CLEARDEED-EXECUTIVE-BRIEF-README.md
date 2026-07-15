# ClearDeed Executive Brief — Design Notes

This is a 2-page executive brief about ClearDeed — a property verification service for the Indian land buyer.

---

## Design Intent

This brief was designed as a polished, confident executive document that:

1. **Establishes trust** through deliberate typography and a sophisticated color palette
2. **Communicates complexity simply** through a 5-stage pipeline diagram and a clear thesis statement
3. **Balances transparency and liability** with distinct visual treatment for different types of information
4. **Reads in 90 seconds** with clear sectioning, metrics, and a pull-quote reinforcing the product philosophy

## Structure

### Page 1
- **Cover band**: Navy header with ClearDeed wordmark and tagline, cream strip with metadata
- **Thesis**: One-sentence product statement + three pillars table
- **Pipeline diagram**: 5-stage visual (Input → Resolve → Pull → Reconcile → Deliver)
- **Sources table**: What each source gives and its status

### Page 2
- **Header**: Mini brand strip
- **Pull quote**: Core product insight about "informed anxiety" (design emphasis: left border accent)
- **Extraction table**: 8 data types pulled from the sources
- **Customer deliverable**: 6-section report walkthrough
- **Stats band**: 4 key metrics (pages, sources, verdicts, price)
- **Liability panel**: Bottom-band disclaimer with gold accent

## Design System

### Color Palette
- Primary: `#1B2A4E` (deep navy)
- Secondary: `#5A6B85` (slate)
- Accent: `#B88A2E` (muted gold)
- Rules: `#C8CFDB` (pale blue)
- Panels: `#F5F2EA` (warm cream) / `#EEF1F7` (cool)

### Typography
- **Display**: Georgia (serif) for titles
- **Body**: Calibri (sans-serif)
- **Sizing**: 22pt body, 28–84pt display sizes, tight line heights

### Visual Hierarchy
1. Navy blocks with white text for critical sections
2. alternating panel backgrounds (white/cream)
3. Gold accents for eyebrows and stats
4. Thin rules sectioning content

## What the Brief Answers

### What ClearDeed does
- Takes a plot ID and claimed owner name
- Pulls 5 source families (Bhulekh, Bhunaksha, IGR, eCourts, RCCMS)
- Reconciles cross-source differences
- Returns a 6-section plain-English report

### Sources we touch
| Source | Status | What Extracted |
|--------|--------|----------------|
| Bhulekh | Primary | RoR front/back pages, tenant, plot, khatiyan, mutation, kisam, due amounts (Odia → English) |
| Bhunaksha | Primary | Cadastral map, polygon, village boundary, tehsil/RI circle |
| IGR | Concierge | EC + Index-II (V1 manual, V1.5 automated) |
| eCourts | Partial | Court cases vs owner name with captcha/name-variant handling |
| Others | Roadmap | CERSAI, RERA, Nominatim, etc. |

### What we extract
- Identity: ULPIN, khatiyan, location metadata
- Owner: Recorded name (Odia + transliteration), family details, ownership flags
- History: Mutation sequence with parties, dates, documents
- Classification: Kisam, permitted use, conversion notes
- Encumbrance: Mortgages, liens, EC status (confidence-aware)
- Disputes: Court cases, revenue cases, OCR handling
- Regulatory: Proximity to protected zones (flags, not clearances)
- Geospatial: Polygon, coordinates, satellite, context

### What the customer gets
A 4–6 page PDF with 6 sections:
1. The Plot – ID, location, map verification
2. The Owner – name match, family, joint flags
3. What you can build – kisam, use, conversion needs
4. Encumbrances & disputes – cases, EC, mutation history
5. Regulatory flags – zone proximity, investigation cues
6. What to ask next – specific questions for seller/broker/lawyer

### Critical philosophy
- **No verdicts.** "Safe to buy" is a ClearDeed anti-pattern.
- **Informed anxiety** is the product: reduce uncertainty on verifiable dimensions, explicitly surface what cannot be verified.
- **Every fact cited to source** and every gap labelled as a manual follow-up.

---

The output is a visually clean executive brief suitable for founder/investor review, investor pitch decks, or early-stage partner briefings.