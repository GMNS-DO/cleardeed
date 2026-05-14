# ComplyRadar Product Strategy

Last updated: 2026-05-14

## 1. Executive Summary

ComplyRadar is a product compliance intelligence layer for Indian MSMEs, importers, D2C brands, e-commerce sellers, customs brokers, and compliance consultants.

The core question it answers is:

> Before I import, manufacture, list, or sell this product in India, what compliance obligations and risks apply?

The product is not a certification agency, not a legal opinion engine, and not a replacement for consultants. It is a source-backed pre-check and monitoring system that converts fragmented regulatory records into a usable product-level risk report.

The ClearDeed analogue:

- ClearDeed: fragmented land/public records -> structured property risk report.
- ComplyRadar: fragmented product/compliance records -> structured product compliance risk report.

The wedge:

> SKU-level pre-import and pre-listing compliance checks for Indian SMEs.

The initial beachhead should be import-heavy categories where regulatory ambiguity is expensive:

1. Furniture
2. Electronics and small appliances
3. Toys
4. Wireless/Bluetooth-enabled devices
5. Packaged food, nutraceuticals, and supplements as a second phase

## 2. Why This Exists

India's product compliance environment is becoming stricter and more fragmented. Regulations are spread across BIS, BIS CRS, DPIIT, DGFT, CBIC, WPC, CPCB, FSSAI, Legal Metrology, ministry notifications, state departments, e-commerce marketplace rules, and Gazette PDFs.

For a large enterprise, this is annoying but manageable. For an MSME, it is existential.

Common failure modes:

- Goods stuck at customs because BIS/WPC/LMPC requirements were discovered too late.
- Imported products cannot be sold because the foreign manufacturer lacks BIS certification.
- Amazon or Flipkart listings get suppressed because documents do not match product category.
- Sellers misunderstand whether the importer, manufacturer, brand owner, or marketplace is responsible.
- Small businesses pay consultants before knowing whether their product even falls under a mandatory category.
- SMEs rely on WhatsApp advice, customs brokers, or YouTube guidance and discover the real rule only after paying suppliers.
- HS/HSN classification errors trigger the wrong duty, wrong certification path, or customs objection.
- EPR, FSSAI, LMPC, and WPC requirements are missed because they are secondary to the main product category.

The pain is high because the mistake happens before cash is recovered:

- Supplier advance paid
- Purchase order placed
- Shipment dispatched
- Inventory manufactured
- Marketplace listing created
- Tender bid submitted

At that point, compliance discovery is too late.

## 3. Market Evidence And Current Signals

### 3.1 Regulatory Sources

BIS says product certification is generally voluntary, but for products notified through Quality Control Orders, mandatory use of the Standard Mark may be required through a BIS license or Certificate of Conformity.

Source: https://www.bis.gov.in/product-certification/product-certification-overview/?lang=en

BIS FMCS FAQ states that certain QCO-notified products can be imported into India only with the Standard Mark under a valid BIS license.

Source: https://www.bis.gov.in/fmcs/fmcs-faqs/?lang=en

BIS CRS lists electronics and IT products covered under the Compulsory Registration Scheme.

Source: https://www.crsbis.in/BIS/products-bis.do

WPC ETA is required for import, sale, and use of wireless communication devices operating in de-licensed frequency bands or involving RF transmission.

Source: https://preprodeservices.dot.gov.in/equipment-type-approval-eta

CPCB requires Producers, Importers, and Brand Owners to register for plastic packaging EPR obligations.

Source: https://cpcb.nic.in/registration-for-brand-owner/

FSSAI states that every Food Business Operator must be licensed or registered under the FSS Act.

Source: https://fssai.gov.in/cms/licensing.php

Legal Metrology governs declarations on pre-packaged commodities.

Source: https://consumeraffairs.nic.in/legalmetrology/legal-metrology-packaged-commodities-rules2011

### 3.2 Forum And Market Pain Signals

Public forums show repeated confusion around:

- Whether BIS applies to furniture imports from China.
- Whether the BIS license must be held by the importer or the foreign manufacturer.
- Whether shipping agents can absorb import compliance liability.
- Whether marketplace sellers can sell BIS-mandatory products without certification.
- Whether small-volume or sample imports are exempt.
- Why FSSAI documents get rejected by Amazon even when the seller believes they are valid.
- Whether Legal Metrology/LMPC is needed for packaged imports.
- Whether wireless features trigger WPC approval.
- Whether EPR applies to small brands and importers.

Representative sources:

- BIS certification for furniture/imports discussion: https://www.reddit.com/r/IndiaBusiness/comments/1tb83ff/bis_certification_for_imports_query/
- BIS certificate for furniture discussion: https://www.reddit.com/r/IndiaBusiness/comments/1rrtc22/bis_certificate_for_furniture/
- BIS certification killing small importers: https://www.reddit.com/r/IndiaBusiness/comments/1pmacyn/bis_certification_killing_small_importers_how_do/
- Amazon rejecting FSSAI license: https://sellercentral.amazon.in/seller-forums/discussions/t/44450b54-3794-4e6e-a5c8-a97fefae6cfb
- FSSAI application reversion pain: https://www.reddit.com/r/IndiaBusiness/comments/1p1fv1s/my_fssai_is_getting_reverted_any_tips/

### 3.3 Existing Alternatives

The market is not empty. Existing alternatives fall into categories:

1. Consultants and filing agencies
   - BIS, WPC, EPR, FSSAI, LMPC, BEE, TEC, CDSCO consultants.
   - Examples: InteLegal, Agile Regulatory, PRP Group, ERCS, UMSPCS, Gold Star, BrandNoder.
   - Strength: trust, filing execution, government process knowledge.
   - Weakness: service-led, opaque pricing, not instant, not SKU-scale, not always source-backed.

2. Customs intelligence tools
   - Examples: TradePrep, CustomsAI India.
   - Strength: HS classification, duty, customs documents, import workflow.
   - Weakness: product compliance may be a module, not the central product.

3. EPR/environment compliance tools
   - Example: Enviro Savvy.
   - Strength: EPR filings, recycling credits, environmental obligations.
   - Weakness: not broad SKU-level import/listing compliance.

4. Broad compliance platforms
   - Example: dcomply.
   - Strength: broad legal/compliance tracking across corporate, DPDP, FSSAI, EHS, etc.
   - Weakness: broad horizontal dashboard, not necessarily product-level import and marketplace readiness.

5. Global product compliance SaaS
   - Example: ProductLex.
   - Strength: enterprise-grade product compliance workflows across many jurisdictions.
   - Weakness: likely enterprise-focused, not India MSME/importer wedge.

The opportunity is not "no one exists." The opportunity is an under-served wedge:

> Indian SKU-level product compliance pre-check and monitoring for MSMEs and their advisors.

## 4. Product Positioning

### 4.1 Category

Product compliance intelligence for Indian SMEs.

### 4.2 One-Line Pitch

ComplyRadar checks whether a product can be imported, manufactured, listed, or sold in India, and flags the certifications, licenses, labels, exemptions, and deadlines that apply.

### 4.3 Longer Pitch

Indian product compliance is scattered across government portals, Gazette notifications, BIS standards, DGFT/CBIC notices, FSSAI rules, WPC approvals, Legal Metrology, EPR portals, and marketplace requirements. ComplyRadar turns these fragmented sources into a source-backed, SKU-level risk report so SMEs can make safer product decisions before they place orders, import inventory, or go live on marketplaces.

### 4.4 What It Is Not

ComplyRadar is not:

- A legal opinion.
- A certification guarantee.
- A customs clearance guarantee.
- A filing agent in V1.
- A replacement for a licensed consultant, customs broker, or lawyer.
- A marketplace approval guarantee.

The product should explicitly say:

> ComplyRadar structures publicly available regulatory information and flags possible obligations. Final applicability may require confirmation from a qualified consultant, customs broker, regulator, or legal professional.

## 5. Target Customers

### 5.1 Primary Initial Customer: SME Importer

Profile:

- Imports from China, Vietnam, UAE, Thailand, or other markets.
- Deals in furniture, electronics, toys, small appliances, lighting, packaged goods, components, or consumer products.
- Often uses a customs broker, freight forwarder, or sourcing agent.
- May not have an internal compliance team.
- Makes decisions at SKU/model level.

Pain:

- "Can I import this?"
- "Does this need BIS?"
- "Does the Chinese manufacturer need certification?"
- "Will customs hold this?"
- "Can I sell this online?"
- "Is a small quantity exempt?"
- "Does Bluetooth/Wi-Fi create WPC requirements?"
- "What documents should I ask the supplier for before paying?"

Willingness to pay:

- High for pre-import reports if the transaction size is meaningful.
- Likely ₹999 to ₹4,999 per SKU check.
- Higher subscription potential for repeat importers.

### 5.2 Secondary Customer: Marketplace Seller

Profile:

- Amazon, Flipkart, Meesho, JioMart, or D2C seller.
- Sells food, supplements, electronics, toys, cosmetics, appliances, packaged goods.
- Faces listing suppression or document rejection.

Pain:

- "Why is Amazon rejecting my FSSAI/BIS document?"
- "Does my manufacturer license cover this product category?"
- "What category should this be listed under?"
- "What declarations are mandatory?"
- "Can I use supplier documents?"

Willingness to pay:

- Medium.
- Per-listing report or document mismatch review.
- Potential channel partnership with seller consultants.

### 5.3 Secondary Customer: Customs Broker / CHA

Profile:

- Handles many import clients.
- Classifies goods, prepares Bill of Entry, advises on duty and compliance.
- Wants faster classification and compliance pre-check.

Pain:

- Repetitive manual checking.
- Clients ask vague questions without specs.
- Need to document advice.
- Liability risk if compliance issue is missed.

Willingness to pay:

- Subscription possible.
- More attractive if product reduces manual lookup time and creates audit-ready reports.

### 5.4 Secondary Customer: Compliance Consultant

Profile:

- Provides BIS, WPC, LMPC, EPR, FSSAI, BEE, TEC services.
- Wants lead qualification and faster pre-checks.

Pain:

- Many low-intent leads ask "do I need certification?"
- Manual applicability checks take time.
- Hard to explain source-backed reasoning to customers.

Willingness to pay:

- Medium-high for internal tool.
- May also become paid fulfillment partner.

### 5.5 Later Customer: Marketplace / Procurement / Large Importer

Profile:

- Marketplace onboarding teams.
- Enterprise procurement teams.
- Large importers with many SKUs.

Pain:

- Need scalable product compliance gates.
- Need supplier document evidence.
- Need monitoring when regulations change.

Willingness to pay:

- High, but long sales cycle.

## 6. Core User Jobs

### Job 1: Pre-Import Decision

"I am considering importing this product. Tell me if it is likely to trigger BIS, WPC, LMPC, EPR, FSSAI, or customs restrictions before I place an order."

### Job 2: Supplier Verification

"The supplier says they are compliant. Check what documents I should ask for and whether their certificate/license appears relevant."

### Job 3: Marketplace Listing Readiness

"Before listing this product, tell me which documents and declarations the marketplace may ask for."

### Job 4: Regulatory Change Monitoring

"Tell me if any new QCO, exemption, or deadline change affects my SKU list."

### Job 5: Consultant Handoff

"If this needs expert filing, generate a concise packet I can share with a consultant/customs broker."

## 7. Product Modules

### 7.1 Product Intake

Inputs:

- Product name
- Product description
- Product photos
- Product category
- Intended use
- Imported or domestically manufactured
- Source country
- Supplier/manufacturer name
- Model number
- Technical datasheet
- HSN/HS code if known
- Material composition
- Power rating/voltage
- Wireless features
- Battery presence
- Food/contact/skin-contact status
- Packaging type
- Marketplace or sale channel
- Quantity/value
- R&D/sample/resale/captive use/export manufacturing

Design principle:

The form should feel like a sourcing checklist, not a legal questionnaire.

### 7.2 Product Identity Normalizer

Purpose:

Convert vague product descriptions into structured product attributes.

Example:

"Bluetooth LED table lamp from China"

Normalizes to:

- Category: lighting / LED luminaire
- Electrical: yes
- Wireless/RF: Bluetooth
- Battery: possible, ask user
- Pre-packaged import: likely
- Consumer product: yes
- Potential regulations: BIS/CRS or ISI depending category, WPC ETA, LMPC, EPR packaging, possible BEE if applicable

### 7.3 HSN/HS Candidate Engine

Purpose:

Suggest possible HSN/HS codes and confidence, but avoid overclaiming.

Outputs:

- Candidate codes
- Why each might apply
- Ambiguity notes
- Documents needed to confirm
- Downstream compliance differences

Critical disclaimer:

HSN/HS classification should be treated as a candidate analysis, not final customs classification.

### 7.4 Compliance Applicability Engine

Checks:

- BIS/QCO
- BIS CRS
- BIS FMCS / foreign manufacturer issue
- WPC ETA
- Legal Metrology / LMPC
- FSSAI
- EPR plastic packaging
- EPR e-waste
- EPR battery waste
- BEE energy labeling
- TEC for telecom equipment
- CDSCO for medical devices, later
- Cosmetics/drugs, later
- DGFT restrictions
- CBIC customs notifications
- Anti-dumping / safeguard / QCO-related customs conditions

Output types:

- Likely applicable
- Possibly applicable
- Not found in current sources
- Manual verification required
- Not enough information

### 7.5 Source-Cited Report Generator

Report sections:

1. Product summary
2. Intended transaction
3. Compliance risk score
4. Applicable checks
5. Possible certifications/licenses
6. HSN/HS ambiguity
7. Supplier/manufacturer document checklist
8. Marketplace/listing risks
9. Exemptions or relaxation possibilities
10. Effective dates and deadlines
11. What we could not verify
12. Recommended next steps
13. Sources
14. Disclaimer

### 7.6 Evidence Vault

Stores:

- Product photos
- Spec sheets
- Supplier certificate uploads
- BIS license screenshots/documents
- WPC ETA
- FSSAI license
- EPR registration
- LMPC certificate
- Marketplace rejection screenshots
- Consultant notes
- Generated reports

### 7.7 Certificate / License Validator

V1:

- Upload document
- Extract certificate number, holder name, product category, model, standard, validity, issuing body
- Compare against product/supplier details
- Flag mismatch risk

V2:

- Link to public verification pages where available.
- Automate verification if legally and technically safe.

Key use case:

"The manufacturer sent me a BIS certificate. Does it actually cover this product/model?"

### 7.8 Regulatory Monitoring

Users can maintain SKU lists and get alerts when:

- New QCO is issued
- Effective date changes
- MSME exemption changes
- Product is added to CRS list
- WPC/ETA rules change
- FSSAI category or licensing rules change
- EPR filing deadline approaches
- Legal Metrology declaration rules change

### 7.9 Partner Marketplace

Not V1, but important later.

Partners:

- BIS consultants
- WPC consultants
- EPR consultants
- FSSAI consultants
- Customs brokers
- NABL labs
- Legal Metrology consultants
- Product testing labs

Model:

- Referral fee
- Verified partner directory
- Report-to-consultant handoff packet

## 8. Risk Scoring

The score should not be a false binary. It should be a decision aid.

### 8.1 Overall Risk Levels

- Green: no mandatory compliance trigger found in current sources, but confirm before transaction.
- Yellow: possible compliance triggers; more information needed.
- Orange: likely compliance obligations; do not proceed without document verification.
- Red: high risk; product appears subject to mandatory compliance or transaction blocker.
- Grey: insufficient data.

### 8.2 Risk Dimensions

1. Product identity confidence
2. HSN/HS classification ambiguity
3. BIS/QCO risk
4. WPC risk
5. EPR risk
6. FSSAI risk
7. LMPC/labeling risk
8. Marketplace listing risk
9. Supplier document risk
10. Deadline/enforcement risk
11. Source confidence

### 8.3 Example Output

Product: imported Bluetooth speaker

Risk: Red

Reason:

- Wireless/RF function likely triggers WPC ETA.
- Electronics category may trigger BIS CRS depending exact product classification.
- Battery, if present, may trigger battery/EPR obligations.
- Pre-packaged import likely triggers Legal Metrology declaration obligations.
- Product cannot be confidently cleared from current information without model/spec sheet.

Next step:

- Ask supplier for model datasheet, BIS CRS registration if applicable, WPC ETA, battery chemistry, packaging label artwork, and importer declaration details.

## 9. Data Sources

### 9.1 Primary Government Sources

- BIS product certification pages
- BIS compulsory certification list
- BIS CRS product list
- BIS FMCS FAQ and guidelines
- DPIIT QCO notifications
- Ministry-specific QCO pages, e.g. Steel Ministry
- DGFT notifications
- CBIC customs notifications
- WPC ETA / DoT eServices
- CPCB EPR portals and notices
- FSSAI FoSCoS/FSSAI licensing rules and FAQs
- Department of Consumer Affairs / Legal Metrology
- Gazette notifications
- BEE product labeling rules
- TEC MTCTE requirements, later
- CDSCO medical device classification, later

### 9.2 Secondary Sources

- Consultant blogs
- Law firm updates
- Marketplace seller forums
- Reddit/forum discussions
- News reports about enforcement
- Marketplace policy pages

Secondary sources should never be the final authority. They are useful for:

- Finding pain points
- Detecting changes
- Interpreting enforcement patterns
- Generating product ideas

### 9.3 Source Reliability Matrix

Similar to ClearDeed, every data point needs a reliability state:

- Official primary source
- Official but outdated or unclear
- Government PDF/Gazette
- Marketplace policy source
- Consultant interpretation
- News report
- Forum anecdote
- User-provided document

Consumer-facing language should depend on source quality.

Example:

Bad:

> Your product does not need BIS.

Better:

> We did not find this exact product in the current BIS CRS list based on the information provided. However, the HS/product classification is ambiguous, so manual confirmation is recommended before import.

## 10. MVP Scope

### 10.1 V0 Concierge MVP

Goal:

Validate willingness to pay and repeatable report structure before building automation.

Features:

- Landing page
- Product intake form
- Manual review workflow
- Source-cited PDF report
- Razorpay/manual payment
- WhatsApp delivery
- Admin spreadsheet/database

Price:

- ₹499 basic pre-check
- ₹1,999 detailed product report
- ₹4,999 urgent pre-import review

Target:

- 50 paid reports
- 10 repeat users
- 5 consultants/CHAs willing to use it internally

### 10.2 V1 Software MVP

Features:

- User login
- Product/SKU profile
- Product intake assistant
- Rule database
- Source management
- Report generator
- Admin review queue
- Evidence vault
- Basic alert subscription
- Report download/share link

Verticals:

- Furniture
- Electronics/accessories
- Toys
- Wireless devices

### 10.3 V2

Features:

- Certificate parser
- Marketplace document checker
- HSN candidate engine
- SKU monitoring
- Consultant/CHA dashboard
- Bulk CSV upload
- API for product checks

### 10.4 V3

Features:

- Marketplace compliance API
- Procurement compliance API
- Consultant partner marketplace
- Lab/consultant workflow handoff
- Regulatory change graph
- Multi-country import/export compliance

## 11. Report Templates

### 11.1 Basic Product Pre-Check

Use case:

Fast check before ordering sample or talking to supplier.

Sections:

- Product identity
- Sale/import context
- Top 3 possible compliance triggers
- Red/yellow/green risk
- Documents to ask supplier
- Source links
- Manual review recommendation

### 11.2 Detailed Import Risk Report

Use case:

Before placing purchase order or shipping goods.

Sections:

- Product details
- HSN candidates
- Regulatory applicability table
- BIS/QCO analysis
- WPC analysis
- LMPC analysis
- EPR analysis
- FSSAI/BEE/TEC if relevant
- Supplier document checklist
- Importer responsibility notes
- Marketplace listing risks
- Confidence metadata
- Sources
- Next steps

### 11.3 Marketplace Listing Compliance Report

Use case:

Amazon/Flipkart listing suppression or pre-listing check.

Sections:

- Product category
- Marketplace issue summary
- Required documents
- Document mismatch analysis
- FSSAI/BIS/LMPC/EPR risks
- Suggested appeal packet
- What to ask manufacturer
- Caveats

### 11.4 Consultant Handoff Packet

Use case:

User needs professional filing.

Sections:

- Product facts
- Regulatory triggers
- Open questions
- Documents collected
- Missing evidence
- Relevant source links
- Suggested consultant type

## 12. Product UX

### 12.1 Main Dashboard

Views:

- My Products
- Risk Status
- Pending Information
- Reports
- Documents
- Alerts
- Expert Review

Product cards:

- Product name
- Category
- Source country
- Risk score
- Last checked
- Active alerts
- Missing documents

### 12.2 Product Detail Page

Tabs:

- Summary
- Compliance Checks
- HSN/HS
- Documents
- Sources
- Alerts
- Notes
- Report

### 12.3 Admin Review Queue

Fields:

- New submission
- Category
- Urgency
- Payment status
- Assigned reviewer
- Missing info
- Source review
- Report status
- Audit status

### 12.4 Source Browser

Internal tool:

- Source title
- Regulator
- URL
- PDF/document
- Effective date
- Product categories
- Standards
- Confidence
- Last checked
- Notes

## 13. Technical Architecture

### 13.1 Initial Stack

- Next.js web app
- Supabase/Postgres
- File storage for uploaded documents
- LLM extraction and report generation
- OCR for PDFs and certificates
- Scheduled crawlers for source monitoring
- Admin review workflow

### 13.2 Data Model

Core tables:

- users
- organizations
- products
- product_attributes
- product_documents
- compliance_checks
- regulatory_sources
- source_snapshots
- qco_notifications
- bis_standards
- crs_products
- wpc_rules
- epr_rules
- fssai_categories
- legal_metrology_rules
- hsn_candidates
- reports
- report_findings
- report_sources
- alerts
- manual_review_notes
- partner_referrals

### 13.3 AI Responsibilities

Safe AI use:

- Extract product attributes from user input.
- Extract facts from regulatory PDFs.
- Draft report language from structured findings.
- Suggest HSN candidates with caveats.
- Compare uploaded certificates against product details.
- Summarize source updates.

Unsafe AI use:

- Final legal applicability determination without source support.
- Claiming compliance certainty.
- Inventing standards or exemptions.
- Replacing expert review for red/high-risk categories.

### 13.4 Output Auditor

Borrow from ClearDeed.

The auditor blocks:

- "Guaranteed compliant"
- "No certification required" without confidence limits
- "You can import safely"
- "Legal approval guaranteed"
- "Customs will clear"
- "Amazon will approve"

Required language:

- Source-backed
- Confidence-tagged
- Manual verification caveats
- Clear distinction between found facts and inference

## 14. Trust And Liability Design

### 14.1 Liability Frame

ComplyRadar provides:

- Public regulatory source aggregation
- Structured risk flags
- Document checklists
- Confidence levels
- Suggested next steps

ComplyRadar does not provide:

- Legal advice
- Customs rulings
- Certification issuance
- Regulatory approval
- Marketplace approval

### 14.2 Trust Mechanisms

- Every finding has a source link.
- Every source has last-checked timestamp.
- Every high-risk result has manual review option.
- Every "not found" result says what was searched.
- Users can download evidence pack.
- Reports include "what we could not verify."
- Human-reviewed reports are clearly marked.

### 14.3 Data Privacy

The platform may process:

- Product details
- Supplier documents
- Import documents
- Certificates
- Business contact details
- Marketplace screenshots

Need:

- Privacy notice
- Data retention policy
- Deletion request process
- Confidentiality around supplier data
- No resale of user documents

## 15. Pricing

### 15.1 Concierge V0

- Basic product pre-check: ₹499
- Detailed report: ₹1,999
- Urgent report: ₹4,999
- Marketplace document issue review: ₹1,499

### 15.2 SaaS V1

Starter:

- ₹2,999/month
- 5 products
- Basic checks
- Alerts

Importer:

- ₹9,999/month
- 25 products
- Detailed reports
- Document vault
- Monitoring

Broker/Consultant:

- ₹24,999/month
- 100 products
- White-label reports
- Bulk upload
- Team access

Enterprise/API:

- Custom

### 15.3 Add-Ons

- Human expert review
- Consultant referral
- Certificate document review
- Marketplace appeal packet
- Supplier compliance checklist
- Bulk SKU import

## 16. Go-To-Market

### 16.1 Beachhead Channels

1. Reddit and founder communities
   - IndiaBusiness
   - StartUpIndia
   - IndianEntrepreneur
   - Amazon seller communities

2. SEO
   - "Does [product] need BIS in India?"
   - "BIS for furniture import from China"
   - "WPC approval for Bluetooth device import"
   - "LMPC certificate for import"
   - "Amazon rejecting FSSAI license"
   - "Does my product need EPR registration?"

3. Consultants and CHAs
   - Offer white-label pre-check reports.
   - Convert them from competitors into distribution.

4. Importer WhatsApp groups and trade associations
   - Furniture importers
   - Electronics importers
   - Toy sellers
   - D2C founder groups

5. Marketplace sellers
   - Listing compliance check
   - Document mismatch review

### 16.2 First Offer

> Planning to import from China? Get a source-backed product compliance pre-check before you pay the supplier.

### 16.3 Landing Page Sections

- Product compliance is discovered too late
- Upload product/spec
- Get BIS/WPC/LMPC/EPR/FSSAI risk report
- Source-backed findings
- Human-reviewed option
- Not legal advice
- Pricing
- Sample report
- Consultant/CHA partner CTA

### 16.4 Early Validation Metrics

- 50 paid reports
- 30% users say report changed purchase/import/listing decision
- 20% repeat purchase rate
- 5 consultants/CHAs request internal access
- 10 products added to monitoring
- At least 3 users ask for consultant referral

## 17. Defensibility

Weak moats:

- Basic scraping
- Basic AI summary
- Generic compliance checklist
- Consultant marketplace

Potential moats:

- Structured regulatory-source database
- SKU-level product attribute graph
- Applicability logic by product category
- Historical regulatory change snapshots
- User-submitted product/document dataset
- Consultant-reviewed findings
- Marketplace document rejection patterns
- API integrations into CHA/importer workflows
- Source reliability matrix and audit trail

The long-term moat is not "we have the PDFs."

The moat is:

> We know how product facts map to Indian compliance obligations, how that mapping changes over time, and how to express uncertainty safely.

## 18. Major Risks

### Risk 1: It Becomes A Services Business

Mitigation:

- Start concierge but structure every report.
- Build reusable rule objects from every manual report.
- Track percentage of report generated from structured rules.
- Use consultants only for fulfillment, not core analysis.

### Risk 2: Liability From Wrong Advice

Mitigation:

- Confidence levels.
- Source-cited findings.
- No guarantee language.
- Manual review gates.
- Professional disclaimers.
- Insurance/legal review before scaling.

### Risk 3: SME Willingness To Pay Is Low

Mitigation:

- Sell before import/order/listing, where risk is obvious.
- Anchor price against shipment loss, customs delay, consultant cost.
- Offer low-cost basic check and higher-cost detailed review.

### Risk 4: Incumbents Add The Feature

Mitigation:

- Own a narrow segment first.
- Build better SKU-level reports.
- Build distribution through CHAs and consultants.
- Create benchmark/category-specific datasets.

### Risk 5: Data Is Too Messy

Mitigation:

- Start with 3-4 categories.
- Maintain manual review.
- Avoid overbroad coverage.
- Use source reliability matrix.

### Risk 6: Consultants See It As Competition

Mitigation:

- Position as lead qualification and report automation.
- Offer white-label dashboard.
- Refer high-risk filings to partners.

## 19. Comparison With ClearDeed

| Dimension | ClearDeed | ComplyRadar |
|---|---|---|
| Core asset | Property risk records | Product compliance risk records |
| User | Land buyer, broker, lawyer, NBFC | Importer, seller, CHA, consultant |
| Frequency | Low for consumers | Higher for businesses |
| Emotional intensity | Very high | High |
| Transaction value | Very high | Medium to high |
| Liability risk | Very high | High |
| Data fragmentation | Very high | High |
| Consumer trust burden | Very high | Medium |
| B2B subscription potential | Medium | High |
| Concierge start | Strong fit | Strong fit |
| State-by-state complexity | High | Medium-high, regulator/category complexity |
| Competition | Medium | Medium-high |
| VC interest | Medium to medium-high | Medium-high if API/workflow layer |

Scores:

- ClearDeed consumer-first: 6.5/10
- ClearDeed B2B property infra: 7.5/10
- ComplyRadar generic compliance: 5/10
- ComplyRadar SKU-level compliance reports: 7.5/10
- ComplyRadar product compliance API/workflow layer: 8/10

## 20. Recommended Execution Plan

### Phase 1: Manual Reports

Duration: 2-3 weeks

Tasks:

- Build landing page.
- Create product intake form.
- Create report template.
- Create source reliability rubric.
- Manually deliver 20 reports.
- Focus on furniture/electronics imports.

Goal:

- Validate that users pay for pre-check before import.

### Phase 2: Structured Database

Duration: 3-4 weeks

Tasks:

- Build regulatory source database.
- Add product attributes schema.
- Add report generator.
- Add admin review queue.
- Add report audit checklist.
- Add source citation management.

Goal:

- Reduce report creation time from 2-4 hours to 30 minutes.

### Phase 3: Monitoring

Duration: 4-6 weeks

Tasks:

- Add SKU watchlist.
- Add source change monitor.
- Add email/WhatsApp alerts.
- Add certificate/document vault.

Goal:

- Convert one-time report buyers into subscription users.

### Phase 4: Partner Dashboard

Duration: 6-8 weeks

Tasks:

- White-label consultant/CHA dashboard.
- Bulk product upload.
- Consultant referral workflow.
- Client-facing report links.

Goal:

- Acquire distribution through advisors.

## 21. First 20 Report Categories To Test

1. Imported wooden chair
2. Imported office chair
3. Imported table/desk
4. LED lamp
5. Solar outdoor light
6. Bluetooth speaker
7. Power bank
8. USB charger
9. Smartwatch
10. Wireless earphones
11. Toy dolls
12. Electric hand blender
13. Hair dryer
14. Kitchen weighing scale
15. Packaged tea
16. Nutraceutical tablet
17. Protein powder
18. Imported plastic household item
19. Battery-operated camping light
20. IoT sensor device

## 22. Key Open Questions

1. Will SMEs pay before they have already faced a problem?
2. Is the buyer importer, CHA, consultant, or marketplace seller?
3. Which category has the strongest urgent pain?
4. Can reports be source-backed enough to reduce liability?
5. Can enough regulatory data be structured without violating portal terms?
6. Do consultants want this as a tool or see it as a threat?
7. Is monitoring more valuable than one-time pre-check?
8. Can the system handle product classification ambiguity safely?

## 23. Bottom-Line Recommendation

Build it, but only with a narrow wedge.

Do not build:

> "All compliance for all MSMEs."

Build:

> "SKU-level import and listing compliance pre-checks for Indian SMEs."

Start with:

> "Before you import furniture/electronics/toys from China, check BIS/WPC/LMPC/EPR risks."

The product can later expand into a broader product compliance data layer, but the first version must be specific, paid, and report-driven.

The investable version is:

> ComplyRadar is the product compliance data layer for Indian commerce. It maps product facts to regulatory obligations, generates source-backed pre-check reports, and monitors SKUs for changing compliance risk.

