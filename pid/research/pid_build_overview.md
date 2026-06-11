# Pattern Intelligence Database Build Overview

Date: 2026-06-12  
Project: ClearDeed PID  
Status: Research and corpus-build phase

## Executive Summary

We are building a standalone Pattern Intelligence Database, or PID, for land and plot purchase risk intelligence.

The goal is to collect raw evidence from public, official, semi-public, and manually supplied sources, preserve that evidence with provenance, extract useful facts from it, identify recurring patterns of land transaction failure, and later match those patterns against a buyer's specific plot details.

This is not a normal scraper project. The final output is not just a pile of documents. The final output should be a reusable intelligence layer that can answer:

> Given a buyer's plot details, what kinds of issues, disputes, frauds, document gaps, encumbrances, title-chain weaknesses, regulatory risks, or seller/project warning signs should be checked, and what evidence pattern supports that concern?

The PID is intentionally being built independently from the main ClearDeed app. Product integration can happen later, after the evidence corpus, source feasibility, extraction logic, and pattern validation workflow are proven.

## Why This Is Being Built

Plot purchase risk is not a single-document problem.

A buyer may have a RoR, EC, sale deed, or broker assurance and still miss risks like:

- unresolved co-owner or partition disputes
- forged or challenged sale deeds
- power-of-attorney misuse
- seller impersonation
- mutation/revenue case disputes
- active civil litigation or injunctions
- government/acquisition corridor risk
- zoning or land-use mismatch
- hidden mortgage/security interest
- auction/SARFAESI recovery signals
- builder or plotted-scheme regulatory non-compliance
- mismatched area, boundary, kisam, or plot identity
- old or incomplete title chain
- prior transactions that do not surface clearly in one document

Most due diligence workflows treat sources separately. The PID is meant to learn across sources.

The underlying idea is:

1. Collect many examples of documents, disputes, notices, orders, cases, and land records.
2. Label what kind of issue each example represents.
3. Extract the key features that made the issue detectable.
4. Convert those features into reusable patterns.
5. When a future buyer brings a plot, compare that plot's available data against these patterns.

## What The Final Outcome Should Be

At the end of this exercise, the expected outcome is a working evidence and intelligence foundation with five major outputs.

### 1. Raw Evidence Archive

A structured archive of downloaded or manually provided artifacts.

Examples:

- RoR HTML/PDF
- EC PDFs
- sale deeds
- RERA/ORERA project records
- ORERA project documents
- land acquisition notices
- SIA/LARR notices
- High Court judgments
- eCourts case pages/orders
- RCCMS case pages/orders
- DRT/DRAT cause lists and orders
- CERSAI search pages/results
- bank auction and possession notices
- BDA/BMC planning/zoning maps
- IGR guidance and deed/EC samples
- consumer commission orders
- lawyer/broker/manual case notes
- certified copies and uploaded documents
- lead-only news/media references

Each artifact should be saved with:

- source id
- source URL
- retrieval timestamp
- query parameters
- access mode
- HTTP status
- content type
- SHA-256 hash
- collector version
- parse/extraction status
- raw file path

The principle is: save the source first, interpret later.

### 2. Source Feasibility Map

For every source, we should know:

- what data it can provide
- whether it is public, gated, captcha-heavy, login-based, payment-based, or manual
- whether it supports bulk collection or only controlled lookup
- what fields can be extracted reliably
- what fields require OCR/manual review
- what risks of false positives exist
- what kind of buyer/seller insight it can support

This prevents us from building a system around sources that look useful in theory but are not practically collectable.

### 3. Evidence-Derived Pattern Library

A library of recurring plot-purchase risk patterns.

Examples:

| Pattern | What It Means |
|---|---|
| Undisclosed co-owner | RoR/title data suggests multiple owners or inheritance branches, but transaction documents show only one seller |
| Active partition dispute | Case/order evidence suggests co-sharers are litigating over the same or related land |
| Sale deed challenge | Court order mentions challenge/cancellation/declaration around a sale deed |
| POA chain weakness | Property transfer relies on PoA documents without clear sale authority or title chain support |
| Hidden charge / mortgage | CERSAI, DRT, auction, or EC/deed evidence suggests security interest or lender action |
| Acquisition corridor risk | Revenue/SIA/LARR notices mention the village/plot/project corridor |
| Zoning mismatch | Planning map or zoning document indicates intended use may conflict with buyer's expected use |
| Mutation/revenue dispute | RCCMS or revenue records show mutation, OLR, settlement, or revenue case activity |
| Builder/project dispute | ORERA/consumer/court records show promoter/project complaints, regulatory gaps, or incomplete filings |
| Boundary/area mismatch | RoR, Bhunaksha, deed schedule, and physical/site data disagree |

These patterns should move through tiers:

- `STUB`: hypothesized pattern, not yet validated
- `PROBABLE`: some evidence-backed examples exist
- `VALIDATED`: enough reviewed cases exist to use confidently

The current seed library has 15 starter patterns at `STUB` tier.

### 4. Insight Generation Framework

The PID should eventually convert raw evidence into buyer-usable insight.

Not:

> This plot is bad.

But:

> This plot has a review signal similar to prior title-dispute cases where sale deeds were challenged because co-owner or partition history was unresolved. Evidence to check: RoR owner structure, deed executants, EC transaction chain, and civil court case search for owner names.

The insight should always separate:

- source fact
- allegation
- inference
- confidence
- evidence strength
- required human/legal review

This is important because land risk intelligence can become legally sensitive if it overstates conclusions.

### 5. Plot Matching Engine

Later, when a buyer provides plot-level inputs, the system should compare those inputs against the pattern library.

Possible buyer inputs:

- district
- tahasil
- village/mouza
- khata number
- plot number
- RoR
- EC
- sale deed
- seller name
- owner name
- promoter/project name
- boundary details
- kisam/classification
- area
- deed number
- SRO
- CERSAI/charge search result
- court/RCCMS case references

The matching engine should produce:

- matching or near-matching source records
- warnings requiring review
- document gaps
- pattern-based explanations
- evidence references
- confidence and limitations
- recommended next checks

## What We Are Not Building Yet

This phase is deliberately not building:

- buyer-facing final risk scoring
- legal conclusions
- automated clean-title certification
- geographic blacklisting
- production ClearDeed report integration
- uncontrolled bulk scraping of brittle/captcha sources
- claims from news/media without official backing
- automated no-risk conclusions from no-result searches

This phase is about building the evidence base and proving what can be responsibly extracted.

## System Philosophy

The PID follows a corpus-first approach.

That means we do not start by asking:

> How do we score one buyer's plot today?

We start by asking:

> Across many real documents and disputes, what actually goes wrong in land and plot transactions, and what evidence signals reveal those problems?

This matters because a plot-level engine without a validated pattern corpus will only produce generic checklist advice. The PID should instead produce intelligence grounded in actual documents, cases, notices, and examples.

## Core Architecture

The architecture has seven layers.

### Layer 1: Source Discovery

Identify sources that can reveal plot-purchase risks.

Source categories:

- land records
- title and registration records
- court and tribunal cases
- revenue disputes
- encumbrance/security interests
- public acquisition/regulatory notices
- zoning/planning maps
- builder/project regulation
- auction/distress notices
- consumer disputes
- manual/certified artifacts
- media leads

Output:

- source list
- difficulty ranking
- expected fields
- access mode
- buyer/seller relevance

Current files:

- `pid/research/source_difficulty_matrix.md`
- `pid/research/source_feasibility.json`
- `pid/research/source_sample_theme_map.md`
- `pid/research/raw_data_scrape_strategy.md`

### Layer 2: Raw Collection

Collect a small number of samples first, then expand only after validation.

Collectors save:

- raw HTML
- raw PDF
- raw JSON/API responses
- images/maps
- query metadata
- manifest rows
- lightweight summaries

Current collector files:

- `pid/collectors/wave1.mjs`
- `pid/collectors/source_samples.mjs`
- `pid/collectors/bhulekh_sample.mjs`

Shared archive helper:

- `pid/lib/raw-archive.mjs`

Current raw data root:

```text
pid/data/raw/
```

Recommended storage shape:

```text
pid/data/raw/
  source_id/
    run_date/
      manifest.jsonl
      artifacts/
        artifact.html
        artifact.pdf
        artifact.json
        artifact.jpg
      extracted/
        artifact_summary.json
        source_sample_summary.json
```

### Layer 3: Text/OCR Extraction

Many land documents are scanned, rotated, image-heavy, Odia-heavy, or encoded in PDFs.

This layer attempts to extract usable text from:

- RoR PDFs
- EC PDFs
- court PDFs
- IGR documents
- ORERA project documents
- RCCMS/court orders
- maps and notices

Current OCR/text work:

- `pid/analysis/pdf-text-poc.mjs`
- `pid/research/pdf_text_ocr_poc_2026-05-26.md`
- generated OCR summaries under `pid/research/generated/`

Current finding:

- ORERA PDFs are mostly image-heavy.
- RoR samples are partially recoverable with rotation/normalization.
- EC samples are harder but recoverable in at least some cases.
- High Court and IGR PDFs need better extraction tooling before theme mining.

### Layer 4: Fact Extraction

Once text is readable, extract structured fields.

Possible fields:

- party names
- owner names
- father/husband names
- khata number
- plot number
- mouza/village
- tahasil/district
- case number
- CNR
- deed number
- EC certificate number
- application number
- SRO
- survey/plot area
- land classification/kisam
- mutation references
- bank/lender names
- borrower/guarantor names
- promoter/project names
- acquisition/project purpose
- order outcome
- document dates
- charge status
- property schedule text

The output should distinguish:

- exact extracted fact
- normalized value
- source location
- extraction confidence
- whether manual review is needed

### Layer 5: Theme and Pattern Labeling

Extracted facts become useful only when mapped to themes.

Themes include:

- title dispute
- partition/co-owner issue
- sale deed challenge
- forged document / impersonation allegation
- PoA misuse or chain weakness
- hidden mortgage/charge
- SARFAESI/auction distress
- acquisition risk
- zoning/planning mismatch
- mutation/revenue dispute
- builder/promoter dispute
- boundary/area mismatch
- government/anabadi/prohibited land
- forest/protected/flood/drainage restriction
- missing document / incomplete chain

Theme labels should be evidence-backed and reviewed.

A single artifact can have multiple labels. For example, a High Court judgment may include:

- sale deed challenge
- partition dispute
- injunction
- co-owner conflict

### Layer 6: Pattern Validation

Patterns should not be treated as reliable immediately.

A pattern becomes stronger as it accumulates:

- multiple reviewed cases
- multiple source types
- consistent field-level signals
- clear buyer relevance
- low false-positive risk
- repeatable extraction logic

Suggested promotion model:

| Tier | Meaning |
|---|---|
| `STUB` | Pattern exists as a hypothesis |
| `PROBABLE` | At least a few reviewed examples support it |
| `VALIDATED` | Enough reviewed examples support operational use |

The current tracker uses:

- `PROBABLE`: at least 5 reviewed examples
- `VALIDATED`: at least 15 reviewed examples

### Layer 7: Plot-Level Matching

This is the downstream usage layer.

When a buyer gives a plot, the system should:

1. Normalize the buyer's plot inputs.
2. Pull available source facts.
3. Compare plot/entity/document fields to the pattern library.
4. Find exact and fuzzy matches.
5. Generate review cards.
6. Link each card to evidence.
7. Explain the risk in buyer-friendly language.
8. State limitations and next checks.

Example future output:

```text
Review Signal: Possible co-owner/title-chain issue

Why this matters:
Prior reviewed cases show sale deeds being challenged when one branch/co-owner executed documents without clear consent from other right-holders.

Matched signals:
- RoR shows multiple owner/tenant blocks or inheritance indicators.
- Sale deed seller list appears narrower than land-record ownership.
- Similar High Court examples mention partition/sale deed challenge.

Evidence to review:
- RoR owner table
- EC transaction chain
- sale deed executants
- court search by owner/seller names

Confidence: Medium
Status: Requires legal review
```

## Source Strategy

Sources are collected in waves from easiest to hardest.

### Wave 1: Easy Public Corpus

Purpose: prove raw archive discipline with relatively accessible sources.

Sources:

- Odisha Revenue acquisition/SIA/LARR
- ORERA/RERA Odisha
- DRT/DRAT cause lists
- Bhunaksha/WFS

What these give:

- acquisition/regulatory evidence
- RERA project/promoter evidence
- bank recovery lead evidence
- plot geometry/spatial identity evidence

Current status:

- Wave 1 collector exists.
- ORERA controlled expansion collected project records, details, and evidence PDFs.
- DRT cause-list samples were captured.
- Revenue/SIA listing pages and PDFs were captured.
- Bhunaksha WFS sample was captured.

### Wave 2: Public But Parsing-Heavy Sources

Purpose: collect high-value public documents that need OCR, PDF extraction, or document parsing.

Sources:

- Orissa High Court PDFs
- BDA/BMC planning/zoning/static maps
- bank auction/public possession notices
- consumer commission records

What these give:

- title dispute examples
- deed/PoA/partition litigation
- zoning and planning constraints
- distress and enforcement signals
- buyer-builder dispute evidence

Current status:

- Few-sample collector exists.
- High Court index/search and 3 seed PDFs collected.
- BDA planning/maps and BDPA land-use image collected.
- OSHB/BDA auction pages collected.
- e-Jagriti/NCDRC pages collected.
- OCR/text extraction still needs improvement before theme mining.

### Wave 3: Brittle Public Search Sources

Purpose: collect targeted samples from sources that require sessions, captcha, known inputs, or careful querying.

Sources:

- Bhulekh RoR
- District eCourts
- High Court eCourts search
- CERSAI public search
- RCCMS
- e-Pauti/revenue receipts

What these give:

- ownership and land classification facts
- direct civil/revenue dispute facts
- charge/security interest facts
- mutation/revenue case facts
- supporting payment/receipt evidence

Current status:

- Bhulekh controlled sample succeeded for Mendhasala plot 415.
- RCCMS login, case-status page, and user manual captured.
- eCourts district and High Court pages captured; captcha hints present.
- CERSAI current asset/debtor/search-report pages captured; old URL returned 404.
- IGR home/static guidance pages captured.

### Wave 4: Manual / Certified High-Value Sources

Purpose: ingest strongest title-chain evidence that may not be scrapeable.

Sources:

- EC PDFs
- sale deeds
- certified SRO copies
- certified court/revenue orders
- manually uploaded documents
- lawyer/operator case notes

What these give:

- title chain
- registered transactions
- deed schedules
- mortgage/lease/gift/partition indicators
- strongest legal evidence

Current status:

- Not yet systematized.
- Manual/upload artifacts are recognized as first-class PID inputs.

### Wave 5: Lead-Only Discovery Sources

Purpose: collect pattern leads, not proof.

Sources:

- news articles
- public FIR/police references where legally accessible
- local media
- public complaint reports

What these give:

- fraud narratives
- local pattern discovery
- entity or project leads

Important constraint:

- These should never be treated as proof without official/court/deed support.

## Current Corpus Status

### ORERA 50-Project Controlled Run

Current raw corpus:

- 50 project-list rows
- 50 project detail bundles
- 250 project detail endpoint calls
- 199 evidence PDFs from 200 document attempts
- 523 extracted JSON files
- about 451 MB raw archive size

Generated candidate intelligence:

- 215 candidate plot/land cards
- 945 metadata-level candidate signals

Signal examples:

- EC PDFs collected
- RoR PDFs collected
- POA without declared sale deed review signals
- owner-share review signals
- complex title-flow signals

Important limitation:

- These are candidate signals, not validated fraud/dispute findings.
- Strong conclusions need OCR/manual review of linked PDFs.

### Wave 2/3 Sample Run

Run date:

```text
2026-05-26-source-samples
```

Captured:

- 34 unique raw sample artifacts
- 44 generated JSON summaries validated

Source folders:

```text
pid/data/raw/orissa_high_court_public/2026-05-26-source-samples/
pid/data/raw/bda_planning_zoning/2026-05-26-source-samples/
pid/data/raw/bank_auction_public_notices/2026-05-26-source-samples/
pid/data/raw/consumer_commission_probe/2026-05-26-source-samples/
pid/data/raw/wave3_brittle_access_probes/2026-05-26-source-samples/
pid/data/raw/bhulekh_ror_samples/2026-05-26-source-samples/
```

Important findings:

- High Court PDFs are available but need better text/OCR extraction.
- BDA planning and maps are available as static pages/images.
- Auction pages are available, but linked PDFs can expire or return 404.
- e-Jagriti/NCDRC are reachable; legacy CONFONET DNS failed.
- Bhulekh RoR can be captured for a controlled known plot.
- RCCMS case-status page is public but needs known-case validation.
- eCourts pages are reachable but captcha/session-gated.
- CERSAI current search pages are reachable, old borrower URL is stale.
- IGR static pages and guidance PDFs are reachable; EC/deed retrieval remains manual/gated.

## How Buyer-Specific Matching Will Work Later

Future flow:

1. Buyer submits plot details and documents.
2. System normalizes identifiers.
3. System fetches or ingests available evidence.
4. PID compares the plot against known patterns.
5. Pattern matcher creates candidate review cards.
6. Human/legal review can approve, downgrade, or reject findings.
7. Buyer report receives carefully worded insights.

### Input Normalization

Normalize:

- district name
- tahasil name/code
- village/mouza name
- khata number
- plot number
- owner/seller names
- father/husband names
- SRO
- deed numbers
- project/promoter names
- area units
- dates
- Odia/English transliteration variants

### Evidence Matching

Matching types:

- exact plot/khata match
- village + owner name match
- seller/promoter entity match
- fuzzy party-name match
- deed number match
- case number/CNR match
- project registration match
- geometry/area mismatch
- document-chain gap detection

### Review Card Output

Each matched insight should include:

- title
- matched pattern
- evidence summary
- source references
- confidence
- why it matters
- what to verify next
- whether it is a fact, allegation, or inference

## Example Final User Outcomes

### Buyer Outcome

A buyer should eventually receive a due-diligence intelligence layer that says:

- what documents are missing
- what source searches were performed
- what risks require review
- what evidence supports each concern
- what no-result searches do and do not mean
- what should be checked by a lawyer/SRO/revenue office before purchase

### Seller Outcome

A seller could use the same intelligence to:

- identify title/document gaps before sale
- prepare missing chain documents
- resolve mutation/revenue issues
- discover stale encumbrance or CERSAI issues
- improve buyer trust with evidence-backed disclosures

### Internal ClearDeed Outcome

ClearDeed gets:

- a proprietary corpus of land-risk evidence
- repeatable collectors
- structured source reliability knowledge
- reviewed pattern library
- reusable matching engine
- defensible insight generation
- stronger moat than a checklist-only product

## Why This Is Valuable

The value is not merely automation. The value is learning from many real-world failure modes.

Most plot buyers ask:

> Is this plot safe to buy?

But the better product answer is:

> These are the known categories of things that go wrong in similar transactions, these are the available evidence checks for your plot, these are the signals we found, these are the gaps, and these are the next verifications needed.

That moves ClearDeed from document retrieval into decision intelligence.

## Quality And Safety Principles

### Evidence Before Claims

Every insight must trace back to evidence.

Bad:

```text
Seller is risky.
```

Good:

```text
Seller name appears in a DRT cause-list sample as respondent/borrower. This is a financial-distress review signal only and requires CERSAI/EC/order follow-up before any conclusion.
```

### No False Clean Chits

A no-result search is not proof of clean title.

For example:

- no CERSAI result does not mean no mortgage
- no eCourts result does not mean no litigation
- no RCCMS result does not mean no mutation issue
- clean EC does not always prove there is no off-record dispute

### Human Review For High-Stakes Claims

Fraud, forgery, ownership defect, and litigation claims need human review before buyer-facing use.

### Source Reliability Matters

Official/certified documents carry more weight than media or anecdotal leads.

Suggested evidence strength:

| Evidence Type | Strength |
|---|---|
| Certified deed/order/EC | Very high |
| Official court/revenue/RERA/CERSAI artifact | High |
| Public official notice | High |
| OCR text from official PDF | Medium until reviewed |
| Metadata-only signal | Low to medium |
| News/media article | Lead only |
| Broker/lawyer note without artifact | Lead only |

## Current Technical Components

### Raw Archive Helper

File:

```text
pid/lib/raw-archive.mjs
```

Responsibilities:

- make source folders
- save artifacts
- hash raw files
- write manifest rows
- save derived JSON
- infer artifact types
- fetch public URLs

### Wave 1 Collector

File:

```text
pid/collectors/wave1.mjs
```

Responsibilities:

- Revenue/SIA collection
- ORERA collection
- DRT cause-list collection
- Bhunaksha WFS sample collection

### Wave 2/3 Sample Collector

File:

```text
pid/collectors/source_samples.mjs
```

Responsibilities:

- High Court public pages/PDF seeds
- BDA planning/zoning samples
- OSHB/BDA auction page samples
- consumer portal probes
- RCCMS/eCourts/CERSAI/IGR access probes

### Bhulekh Controlled Sample Collector

File:

```text
pid/collectors/bhulekh_sample.mjs
```

Responsibilities:

- call existing Bhulekh fetcher for one controlled known plot
- save raw RoR HTML
- save parsed result JSON
- prove controlled RoR capture path

### ORERA Insight POC

File:

```text
pid/analysis/orera-insight-poc.mjs
```

Responsibilities:

- convert ORERA project/detail metadata into candidate risk cards
- identify metadata-level review signals
- produce generated JSON/Markdown outputs

### PDF Text/OCR POC

File:

```text
pid/analysis/pdf-text-poc.mjs
```

Responsibilities:

- triage PDFs
- detect embedded image streams
- attempt OCR with rotation/normalization
- record extraction status
- extract early content hints

## Key Design Decisions

| Decision | Reason |
|---|---|
| PID is independent of `/app` | Keeps research/build separate from product integration |
| Corpus-first, not plot-first | Need real evidence patterns before buyer-facing matching |
| Save raw before parsing | Allows reprocessing as extraction improves |
| Few samples before bulk | Prevents brittle/captcha sources from derailing the build |
| Manual/certified docs are first-class | Strongest land evidence may not be scrapeable |
| Evidence strength tiers | Prevents overclaiming from weak sources |
| No geography blacklisting | Avoids harmful and legally risky area-based labeling |
| Human review gates | Necessary for fraud/dispute/title defect claims |

## Roadmap From Here

### Phase A: Strengthen Extraction

Goal:

- make High Court, IGR, ORERA, RoR, and EC PDFs more readable

Tasks:

- improve OCR pipeline
- support Odia where possible
- extract page-level text
- preserve OCR confidence
- build side-by-side review summaries

### Phase B: Curate Reviewed Seed Cases

Goal:

- create 20-50 reviewed examples of real plot issues

Tasks:

- select cases from High Court, ORERA, DRT, Bhulekh, CERSAI, manual docs
- label themes
- separate fact/allegation/inference
- link each label to artifacts

### Phase C: Pattern Promotion

Goal:

- move selected patterns from `STUB` to `PROBABLE`

Tasks:

- require at least 5 reviewed examples per pattern
- document field-level signals
- document false-positive risks
- create matching rules

### Phase D: Controlled Brittle Source Samples

Goal:

- validate eCourts, RCCMS, CERSAI, and IGR workflows with known inputs

Tasks:

- collect known CNR/case examples
- run one CERSAI known borrower/asset sample
- run one RCCMS known-case sample
- capture query metadata and screenshots
- record captcha/session failures accurately

### Phase E: Plot Matching POC

Goal:

- take one or more buyer-like plot inputs and generate review cards

Tasks:

- normalize plot inputs
- connect RoR/EC/deed/source facts
- match against initial pattern rules
- produce evidence-backed review cards
- review wording for legal safety

### Phase F: Product Integration Later

Goal:

- integrate validated insights into ClearDeed reports

Tasks:

- define API shape
- define confidence display
- define user-facing language
- define disclaimer/human-review workflow
- test on 10 plots

## Success Criteria

This exercise is successful when we have:

1. A raw archive with repeatable provenance.
2. A source feasibility map grounded in actual samples.
3. A working OCR/text extraction path for key PDFs.
4. At least 20 reviewed evidence examples.
5. At least 3 patterns promoted beyond `STUB`.
6. A plot-matching POC that creates evidence-backed review cards.
7. Clear separation between source facts, allegations, and inferred risks.
8. A path to integrate the intelligence into ClearDeed reports.

## Plain-English End State

At the end, you should have a system that can look at a plot and say:

> Based on the documents and public evidence available, here are the kinds of things that have gone wrong in similar plot transactions, here are the signals we found for this plot or seller/project, here are the missing checks, and here is the evidence trail behind every warning.

That is the core outcome of the PID build.

