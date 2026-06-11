# PID Source Difficulty Matrix

Date: 2026-05-25

Purpose: rank land/plot-buyer evidence sources from easiest to hardest to obtain, and list what each source can contribute before any synthesis or insight generation.

## Effort Levels

| Level | Meaning |
|---|---|
| 1 Easy | Public page/file, mostly crawlable/downloadable |
| 2 Moderate | Public but needs parsing, pagination, map/PDF handling, or stable query parameters |
| 3 Hard | Public but brittle: browser sessions, captcha, name variants, weak search, or noisy matching |
| 4 Very hard | Login/payment/manual retrieval, certified documents, or heavy OCR/review |
| 5 Partnership/manual-heavy | Not realistically complete through scraping alone; needs uploads, operators, legal review, or institutional access |

## Easiest To Hardest

| Rank | Source | Effort | What It Gives Us | Buyer/Seller Use |
|---:|---|---:|---|---|
| 1 | Odisha Revenue acquisition/SIA/LARR pages | 1 | acquisition notices, SIA notifications, declaration notices, village/area/project/date/letter number | Check if land/village is affected by acquisition, public project, compensation, or corridor activity |
| 2 | ORERA/RERA Odisha public portal | 1-2 | registered projects, promoter/agent info, public project links, complaint entry points | Useful when plot is part of a plotted scheme, developer sale, apartment/project, or promoter transaction |
| 3 | DRT/DRAT public CIS cause lists | 2 | bank recovery matters, SARFAESI-type proceedings, lender/borrower names, case numbers, forum/date | Seller/entity financial distress signal; triggers CERSAI/EC/order follow-up |
| 4 | Bhunaksha / cadastral WFS / map layers | 2 | plot geometry, computed area, adjacency, village/layer metadata, spatial identity | Boundary, area mismatch, access/adjoining plot, and plot-identity checks |
| 5 | Static official zoning/forest/flood/planning PDFs or GIS layers | 2-3 | zoning category, forest/protected overlay, flood/drainage hazard, road/master-plan constraints | Regulatory/use restriction checks; useful before construction or conversion |
| 6 | Bank auction / possession / public notice pages | 2-3 | auction notices, possession notices, borrower names, property descriptions, lender, reserve price | Detect distressed/charged property or seller/entity under enforcement |
| 7 | Orissa High Court public PDFs/archives | 2-3 | judgments/orders, acquisition disputes, title appeals, PoA/deed disputes, SARFAESI writs | High-value legal dispute examples; requires PDF text/OCR and property linkage |
| 8 | Consumer Commission public cases/orders | 2-3 | buyer-builder disputes, refund/delay orders, deficiency findings, project/promoter complaints | Developer/project risk, especially plotted schemes and housing projects |
| 9 | MCA/ROC public company data | 2-4 | company status, directors, charges, filings, registered office, promoter/entity identity | Company seller/promoter due diligence; charge and insolvency lead generation |
| 10 | NCLT/IBBI insolvency records | 2-4 | insolvency admission, liquidation, moratorium, RP/liquidator data, creditor proceedings | Corporate seller/promoter distress and sale-authority checks |
| 11 | Bhulekh Odisha RoR | 3 | owner/tenant rows, co-owners, khata/plot, kisam/classification, area, remarks, mutation/case anchors | Core land-record fact base: ownership, classification, co-owner, government-land, area and remarks signals |
| 12 | District eCourts | 3-4 | civil suits, partition, injunction, title declaration, cancellation, fraud/forgery cases, CNR/orders | Direct dispute detection by party/case/property text; noisy and captcha/session-heavy |
| 13 | CERSAI public search | 3-4 | active/satisfied security interests, borrower/chargor, secured creditor, amount, property description, status | Mortgage/charge detection, especially equitable mortgages missing from local EC |
| 14 | RCCMS Odisha / revenue court cases | 3-4 | mutation/revenue disputes, OLR/ceiling/settlement cases, revenue orders/status | Best as follow-up from Bhulekh remarks or known case numbers; weak for broad discovery |
| 15 | e-Pauti / land revenue receipts/details | 3-4 | revenue payment, dues, payer, khata/holding references, receipt date | Supporting evidence only; helps cross-check payer/khata but does not prove title |
| 16 | IGR Odisha EC / registered deed records | 4-5 | sale chain, deed numbers, parties, mortgages, leases, gifts, PoA, partition deeds, attachments, SRO/search period | Highest-value title-chain and encumbrance evidence, but often login/payment/manual/certified retrieval |
| 17 | Certified copies from SRO/courts/revenue offices | 5 | official deed/order/case copies, certified schedules, complete property descriptions | Strongest evidence for legal review and final confirmation |
| 18 | Manual lawyer/broker/operator case notes | 5 | known fraud/dispute patterns, local context, deed defects, possession issues, missing documents | Very high insight value if linked to artifacts; cannot stand alone as proof |
| 19 | News articles / police/FIR reports / local media | 5 | fraud narratives, land mafia reports, forgery/impersonation allegations, public dispute stories | Useful for lead generation and pattern discovery; requires credibility/relevance review |

## Practical Extraction Order

| Wave | Sources | Why This Order |
|---|---|---|
| Wave 1 | Revenue/SIA/LARR, ORERA, DRT cause lists, Bhunaksha/WFS | Public, relatively extractable, useful for building the evidence archive shape |
| Wave 2 | High Court PDFs, static zoning/forest/flood layers, auction notices, consumer cases | Public but needs stronger PDF/OCR/parsing and entity/property matching |
| Wave 3 | Bhulekh, district eCourts, CERSAI, RCCMS | Higher value but brittle; needs browser sessions, captcha/name variants, or known case references |
| Wave 4 | IGR EC/deeds, certified copies, uploaded artifacts, manual case notes | Highest legal value; cannot be complete through scraping alone |
| Wave 5 | News/FIR/media corpus | Useful for pattern discovery, but noisy and requires strict credibility labeling |

## Sample Status — 2026-05-26

| Source | Sample Status | Notes |
|---|---|---|
| Orissa High Court public PDFs/archives | Sampled | Public index/search pages and 3 land/deed/acquisition PDFs saved; OCR/text extraction is the next gate |
| Static planning/zoning pages | Sampled | BDA notice/planning/maps pages and BDPA proposed land-use image saved |
| Bank auction/public notices | Sampled with stale-link warning | OSHB/BDA index pages saved; 2 linked OSHB auction PDFs returned 404 |
| Consumer Commission | Access sampled | e-Jagriti/NCDRC reachable; legacy CONFONET DNS failed |
| Bhulekh Odisha RoR | Controlled sample passed | One Mendhasala plot 415 RoR saved and parsed; keep controlled before scaling |
| District/High Court eCourts | Access sampled | Public forms reachable; captcha hints present, so use known-case/known-party samples next |
| CERSAI public search | Access sampled | Current asset/debtor/search-report pages reachable with captcha/login hints; old borrower URL 404 |
| RCCMS Odisha | Access sampled | Login, public case-status page, and user manual saved; known-case sample needed |
| IGR Odisha | Static samples saved | Home, Know Your SRO, and official registration guidance PDFs saved; EC/deed retrieval remains manual/gated |

## Source Output Types

| Output Type | Sources |
|---|---|
| Plot facts | Bhulekh, Bhunaksha/WFS, EC/deeds, certified copies |
| Ownership/title facts | Bhulekh, IGR EC/deeds, court orders, RCCMS, manual reviewed artifacts |
| Litigation/dispute facts | District eCourts, Orissa High Court, RCCMS, DRT/DRAT, consumer cases |
| Encumbrance/financial facts | CERSAI, IGR EC/deeds, DRT/DRAT, MCA charges, bank auction notices |
| Regulatory/acquisition facts | Revenue/SIA/LARR, Gazette, zoning/planning, forest/flood layers, ORERA |
| Actor/entity facts | ORERA, MCA/ROC, NCLT/IBBI, DRT, court cases, manual notes |
| Pattern leads only | news, police/FIR articles, broker/lawyer anecdotes without artifacts |
