# ComplyRadar 0-to-1 Master Strategy

Last updated: 2026-05-14

Status: Founder strategy document for review

Working thesis:

> ComplyRadar should not start as a one-time compliance report product. It should start as a narrow, deep, consultant-assisted product-compliance intelligence system for Indian wireless/electronics commerce, then expand into recurring SKU monitoring, importer/brand workflows, and finally an API/data layer for marketplaces, ERPs, logistics platforms, and compliance operators.

This document is written for a solo technical founder building with Claude Code, Codex, and AI-assisted product development leverage. It assumes the founder can ship software quickly, but must still earn domain truth, customer trust, and distribution the slow way.

## 1. Executive Decision

### 1.1 The Company To Build

Build:

> **A product-compliance system of record for Indian commerce.**

Starting wedge:

> **Wireless and consumer-electronics SKU compliance intelligence for Indian importers, CHAs, compliance consultants, D2C brands, and marketplace sellers.**

The first product should help a professional answer:

> For this exact SKU/model, intended for import and sale in India, what BIS, WPC/ETA, Legal Metrology, EPR, marketplace-listing, and evidence/document obligations apply, what is missing, and what changed since the last check?

The first commercial customer should not be a random consumer or casual seller. The first commercial customer should be a person who already handles repeated compliance questions:

- CHA/customs broker
- BIS/WPC consultant
- import consultant
- electronics compliance consultant
- large Amazon/Flipkart seller consultant
- D2C/electronics importer with 50+ active SKUs

### 1.2 What Changed From The Earlier Strategy

The earlier ComplyRadar idea was:

> Source-backed pre-import/pre-listing checks for Indian MSMEs.

That is still useful, but not enough.

The stronger revised idea is:

> Pre-import checks are the acquisition wedge. Continuous SKU monitoring and professional workflow are the business.

This matters because a one-time report has weak retention. A product portfolio has ongoing risk. Regulations change, BIS/CRS categories expand, QCO deadlines shift, WPC/ETA expectations evolve, marketplace enforcement tightens, supplier certificates expire, and listings can be suppressed. That creates a recurring need.

### 1.3 The Strategic Choice

Do not build broad compliance software for all Indian SMEs.

Do not build a generic AI chatbot for compliance.

Do not build a low-ticket B2C report marketplace as the main business.

Build a narrow system that becomes extremely reliable in one painful vertical:

> **Electronics and wireless-product compliance in India.**

The first 12 months should optimize for depth, accuracy, trust, and workflow adoption in this vertical.

### 1.4 Why This Can Be A Real Company

The company can become meaningful because the defensible asset is not the UI. It is the structured regulatory-product graph:

- product type
- model/SKU attributes
- HSN candidates
- BIS CRS category
- applicable Indian Standard
- WPC/ETA applicability
- frequency bands
- evidence requirements
- import constraints
- labeling requirements
- EPR obligations
- marketplace listing rules
- document validity
- renewal dates
- regulatory-change impact
- source-backed confidence

The long-term product is not "AI answers." The long-term product is:

> A living map from product facts to commerce permissions, obligations, risks, evidence, and deadlines.

That can compound.

## 2. Market Reality

### 2.1 The Regulatory Surface Is Fragmented

Indian product compliance is spread across:

- BIS product certification
- BIS Compulsory Registration Scheme
- Quality Control Orders
- WPC/DoT Equipment Type Approval
- DGFT import policy
- CBIC customs enforcement
- Legal Metrology packaged-commodity declarations
- CPCB EPR regimes for e-waste, battery waste, plastic packaging, tyres, and other categories
- FSSAI for food products
- BEE for energy labeling
- TEC/MTCTE for telecom products
- CDSCO for medical devices and cosmetics
- marketplace-specific rules and enforcement
- Gazette notifications, circulars, FAQs, and portal updates

The data exists, but it is not usable at SKU level for an SME operator.

BIS states that product certification is generally voluntary, but for certain products notified through Quality Control Orders, compliance to Indian Standards is made compulsory, with mandatory use of Standard Mark under a BIS licence or Certificate of Conformity. Source: https://www.bis.gov.in/product-certification/products-under-compulsory-certification/?lang=en

BIS FMCS FAQ says that certain QCO-notified products can be imported into India only with Standard Mark under a valid BIS licence. Source: https://www.bis.gov.in/fmcs/fmcs-faqs/?lang=en

BIS CRS maintains a list of electronics and IT goods covered under the Compulsory Registration Scheme. Source: https://www.crsbis.in/BIS/products-bis.do

WPC/ETA is required for import, sale, and use of wireless communication devices operating in de-licensed frequency bands or involving RF transmission. The DoT ETA page explicitly includes finished products such as smart watches, short-range devices, microphones, speakers, headphones, earphones, printers, scanners, and cameras. Source: https://preprodeservices.dot.gov.in/equipment-type-approval-eta

The 2025 CCPA radio-equipment e-commerce guidelines are especially important. They apply to e-commerce platforms, manufacturers, importers, sellers, and service providers offering radio equipment. They require listing-level regulatory evidence such as ETA details, frequency ranges, test reports, and takedown of listings lacking required information. They also require automated keyword and frequency-based scanning by platforms. Source: https://doca.gov.in/ccpa/files/Guidelines%20for%20the%20Prevention%20and%20Regulation%20of%20Illegal%20Listing%20and%20Sale%20of%20Radio%20Equipment%20including%20Walkie%20Talkies%20on%20ECommerce%20Platforms%2C%202025.pdf

FSSAI states that every Food Business Operator in India must be licensed under the FSSAI framework. Source: https://fssai.gov.in/cms/licensing.php

Legal Metrology packaged-commodity rules require mandatory declarations on pre-packaged commodities, including importer/manufacturer details and other label information. Official page: https://consumeraffairs.nic.in/legalmetrology/legal-metrology-packaged-commodities-rules2011

### 2.2 The Customer Pain Is Not Abstract Compliance

The real pain is not "I want to be compliant."

The real pains are:

- "Will customs stop this shipment?"
- "Can I import this model?"
- "Does my Chinese supplier's certificate cover this exact model?"
- "Can I list this product on Amazon/Flipkart?"
- "Why did my listing get blocked?"
- "Do I need WPC ETA because this has Bluetooth?"
- "Is this BIS CRS or ISI or Scheme X?"
- "Does the manufacturer need to hold the licence, or can I?"
- "Do I need LMPC before clearance?"
- "Does EPR apply because this is electronics/battery/plastic packaging?"
- "Did a new notification affect my existing SKUs?"
- "Which of my 200 SKUs are now risky?"

The product should speak to these moments, not to abstract "compliance management."

### 2.3 Why Wireless/Electronics Is The Best First Vertical

Wireless/electronics is the best first wedge because it has the right combination of pain, repeatability, data structure, and urgency.

Strong reasons:

- **BIS CRS relevance:** many electronics categories are explicitly covered under BIS CRS.
- **WPC/ETA confusion:** Bluetooth, Wi-Fi, RF, smart devices, and IoT create cross-regime ambiguity.
- **Marketplace enforcement:** the 2025 CCPA guidelines create listing-level compliance pressure for radio equipment.
- **High SKU counts:** importers and D2C brands often manage many models, variants, bundles, and accessories.
- **Meaningful transaction value:** a shipment delay or blocked listing can cost much more than a SaaS subscription.
- **Structured technical attributes:** frequency band, RF output, product type, model number, adapter/battery attributes, and test report evidence can be modeled.
- **Advisor-driven market:** CHAs and consultants are already in the workflow.

This is better than starting with furniture, food, cosmetics, or all MSME compliance because it gives a tighter source corpus and clearer recurring monitoring wedge.

### 2.4 Existing Players

This market is not empty.

TradePrep is a customs-intelligence platform for Indian importers/exporters. It offers HS classification, duty calculations, document OCR, container tracking, FTA rates, and BIS compliance checks. Source: https://tradeprep.in/

CustomsAI India operates around customs, HSN classification, duty, exemptions, notice replies, and compliance guidance. Source: https://www.customsai.in/

ProductLex is a global product-compliance intelligence platform with living regulation databases, product mapping, monitoring, gap analysis, and document generation. Source: https://productlex.com/

Other global regulatory-intelligence products exist, including RegASK, Foresight, RegPulse, RecallWatch AI, Cleo Labs, and others. They validate the category but are not necessarily focused on Indian SME electronics importers.

Consultants and certification agencies are everywhere:

- BIS consultants
- WPC/ETA consultants
- LMPC consultants
- EPR consultants
- FSSAI consultants
- CHA/customs brokers
- test-lab intermediaries

### 2.5 The Differentiation

The winning wedge is not:

> "We have an AI that answers compliance questions."

That is weak and easy to copy.

The differentiated claim should be:

> "We maintain an India-specific SKU compliance graph that maps electronics product attributes to regulatory obligations, source evidence, marketplace listing requirements, and regulatory-change impact."

Competitor comparison:

| Player type | What they do well | Where ComplyRadar can differ |
|---|---|---|
| Customs platforms | HSN, duty, documents, shipment workflow | Deeper SKU-level product compliance and monitoring |
| Consultants | Filing execution, human trust, edge cases | Faster pre-checks, source-backed reports, portfolio monitoring |
| Broad compliance platforms | Regulatory calendar, legal obligations | Product/SKU graph and importer workflow |
| Global product-compliance SaaS | Enterprise compliance workflows | India-first, SME/consultant-first, BIS/WPC/local marketplace depth |
| ChatGPT-like tools | General answers | Structured source-backed system of record with audit trail |

### 2.6 Market Timing

The timing is attractive because:

- AI tooling makes ingestion, extraction, classification, and report generation possible for a solo founder.
- Indian commerce is becoming more compliance-heavy.
- Marketplaces face regulatory pressure to police listings.
- Indian SMEs import and sell products faster than their compliance maturity improves.
- Consultants still work in spreadsheets, PDFs, WhatsApp, and manual lookup.
- The early product can be built narrow, but the data asset expands category by category.

## 3. Business Strategy

### 3.1 The Strategic Sequence

The company should grow through four stages:

1. **Advisor workflow wedge**
2. **Importer/brand SKU monitoring**
3. **Marketplace/API compliance checks**
4. **Multi-vertical product-compliance infrastructure**

The first buyer is the advisor. The first end-beneficiary is the importer/seller. The eventual enterprise buyer is the platform that needs compliance checks at scale.

### 3.2 Why Consultant/CHA-First

Consultant-first is not just a distribution hack. It is a product-quality strategy.

Benefits:

- Consultants already understand the pain.
- They have repeated volume.
- They bring real cases.
- They can identify wrong outputs quickly.
- They reduce CAC because each consultant touches many SMEs.
- They reduce direct liability because ComplyRadar is positioned as professional workflow software.
- They provide credibility when later selling direct to importers.

Direct-to-SME too early is risky because the SME often cannot judge whether the output is correct. They may trust a wrong answer until a shipment or listing fails.

### 3.3 The Ideal First Customer

The ideal first customer has:

- 20+ compliance/import queries per month
- electronics or wireless exposure
- repeated interaction with BIS/WPC/ETA
- willingness to give feedback
- reputation risk if advice is wrong
- spreadsheet/manual process today
- strong client relationships
- need for branded reports

Examples:

- a BIS/WPC consultant serving electronics importers
- a CHA with a client base in electronics
- a sourcing agent importing Bluetooth/audio accessories
- a marketplace seller consultant handling listing suspensions
- an electronics D2C brand with many active SKUs

### 3.4 The First Paid Offer

Do not sell "software" at first.

Sell:

> "We will map your last 20 electronics SKU inquiries into a structured compliance workspace, generate source-backed pre-check reports, and monitor those SKUs for BIS/WPC/marketplace changes for 90 days."

First design-partner package:

- onboarding of 20-50 SKUs
- source-backed applicability review
- branded PDF reports
- evidence checklist
- SKU risk dashboard
- weekly change digest
- one feedback call per week

Suggested price:

- first 5 design partners: free or ₹5,000/month with heavy feedback commitment
- next 10 customers: ₹8,000-₹15,000/month
- mature consultant plan: ₹20,000-₹50,000/month depending on volume and white-label usage

Avoid pure free users unless they give you real cases and weekly feedback. Free without commitment creates fake validation.

### 3.5 Pricing Architecture

Initial pricing should be simple and founder-sold.

#### Concierge / Design Partner

For first 90 days:

- ₹0-₹5,000/month
- 20-50 SKUs
- weekly feedback call required
- permission to use anonymized learnings
- no guarantee language

#### Consultant Starter

For small consultants:

- ₹9,999/month
- 50 active SKUs
- 25 report generations/month
- source-cited reports
- evidence checklist
- client-ready PDF
- change alerts

#### Consultant Pro

For serious consultants/CHAs:

- ₹24,999/month
- 250 active SKUs
- 100 report generations/month
- branded reports
- client portal
- bulk upload
- renewal tracking
- priority source verification

#### Importer/Brand Portfolio

For D2C/import brands:

- ₹19,999/month
- 200 active SKUs
- portfolio dashboard
- compliance gap tracking
- certificate vault
- marketplace readiness status
- monthly compliance digest

#### API / Marketplace

Later:

- platform fee + usage
- ₹1-₹20 per SKU/listing check depending on depth
- enterprise minimums
- SLA and custom data agreements

### 3.6 Revenue Model Evolution

The company should evolve from service-assisted SaaS into data infrastructure:

| Stage | Revenue type | Why |
|---|---|---|
| 0 | Paid pilots / concierge reports | Learn domain and customer language |
| 1 | Consultant SaaS | Repeated workflow, better feedback |
| 2 | Importer portfolio SaaS | Higher ACV and recurring need |
| 3 | API usage | Marketplace/ERP/logistics scale |
| 4 | Data licensing / ecosystem | Defensible compliance graph |

### 3.7 VC-Style Rating

Version ratings:

| Version | Rating | Rationale |
|---|---:|---|
| One-time compliance reports | 5.5/10 | Useful but low retention and CAC-sensitive |
| Direct SME pre-import checker | 6.5/10 | Better pain, but trust and distribution are hard |
| Consultant/CHA workflow for electronics | 8/10 | Strong wedge, domain feedback, repeat usage |
| Continuous SKU monitoring for importers/brands | 8.5/10 | Recurring, higher ACV, clear operational need |
| India product-compliance API | 9/10 potential | Bigger platform play, but not a day-one product |

Compared with ClearDeed:

| Dimension | ClearDeed | ComplyRadar |
|---|---|---|
| Initial user emotion | Very high | Medium |
| Repeat usage | Low for consumers | High for consultants/importers |
| B2B expansion | Possible but later | Natural |
| Liability risk | High consumer misunderstanding risk | High but manageable with professional workflow |
| Data moat | Strong if records are hard to normalize | Strong if SKU-rule graph is accurate |
| Distribution | Hard consumer trust problem | Easier through consultants/CHAs |
| ACV potential | Low-to-medium early | Medium-to-high |
| VC ceiling | Good if infra/API | Stronger if API/marketplace integration |

My revised view:

> ComplyRadar has a better B2B SaaS path than ClearDeed. ClearDeed has a more intuitive emotional wedge. ComplyRadar has the better recurring revenue and infrastructure path if you survive domain depth.

### 3.8 What Must Be True

The business works if:

- consultants/CHAs will trust a source-backed software layer
- the product is accurate enough in a narrow vertical
- users maintain active SKU portfolios in the product
- monitoring alerts are specific and actionable
- marketplace enforcement keeps increasing
- the company can convert consultant trust into importer/brand adoption
- the regulatory graph compounds faster than competitors can copy it

The business fails if:

- outputs are vague
- accuracy is not reliable
- the founder avoids domain work
- the product becomes a generic chatbot
- consultants see it as a lead threat rather than workflow leverage
- the system cannot prove source provenance
- users do not maintain SKU data after first check

## 4. Product Strategy

### 4.1 Product Vision

Long-term vision:

> Every product sold in India has a machine-readable compliance profile.

ComplyRadar becomes the system that answers:

- What is this product?
- Which Indian regulations apply?
- Which documents are required?
- Which source says so?
- Which evidence do we have?
- Which evidence is missing?
- Which deadlines matter?
- Which SKUs are affected by a new rule?
- Can this SKU be imported, listed, or sold with current evidence?

### 4.2 Category Definition

Category:

> Product compliance intelligence and monitoring.

Not:

- generic legal compliance
- generic customs software
- certification filing agency
- AI chatbot
- marketplace listing tool

### 4.3 Positioning Statement

For Indian electronics importers, CHAs, and compliance consultants who need to assess and monitor SKU-level regulatory risk, ComplyRadar is a product-compliance intelligence platform that maps product attributes to BIS, WPC/ETA, marketplace, labeling, and evidence obligations. Unlike generic customs tools or manual consultants, ComplyRadar maintains a source-backed SKU compliance graph, generates professional reports, and continuously monitors products for regulatory-change impact.

### 4.4 First Vertical Scope

First vertical:

> Wireless and consumer electronics.

Included in first 90-180 days:

- Bluetooth speakers
- wireless headphones/earbuds
- smart watches
- smart speakers
- Wi-Fi routers
- wireless keyboards/mice
- webcams
- CCTV cameras
- power banks
- adapters/chargers
- LED lighting products
- mini printers
- microphones
- POS devices
- tablets
- mobile phones/accessories where feasible
- IoT sensors/gateways where feasible

Not included initially:

- medical devices
- cosmetics
- toys
- food
- furniture
- industrial machinery
- telecom carrier-grade equipment
- drones, satellite equipment, jammers, radar, and other special categories except as "out of scope / high-risk route" flags

### 4.5 Product Layers

ComplyRadar has five product layers.

#### Layer 1: Product Identity Layer

Goal:

Convert messy product inputs into normalized product facts.

Inputs:

- product name
- SKU/model number
- product URL
- Alibaba/IndiaMART/Amazon listing
- invoice
- packing list
- spec sheet
- manual
- product image
- declared HSN
- supplier name
- manufacturer name
- country of origin
- intended channel
- importer/brand owner

Outputs:

- normalized product category
- candidate product types
- technical attributes
- RF attributes
- battery attributes
- power attributes
- wireless protocols
- model identifiers
- accessory/bundle relationships
- missing information
- ambiguity flags

Product principle:

The system should never pretend to know what it cannot know. Missing RF frequency, model, manufacturer, or test-report details should become explicit intake gaps.

#### Layer 2: Regulatory Knowledge Graph

Goal:

Maintain structured mappings between product facts and regulatory obligations.

Core entities:

- ProductType
- ProductAttribute
- HSNCode
- BISCRSCategory
- IndianStandard
- QCONotification
- WPCRule
- FrequencyBand
- MarketplaceRule
- EvidenceRequirement
- Certificate
- TestReport
- Manufacturer
- Importer
- SKU
- RegulatorySource
- ChangeEvent
- ApplicabilityRule
- ExemptionRule
- RiskFlag

Important relationships:

- ProductType may map to BISCRSCategory
- BISCRSCategory requires IndianStandard
- ProductAttribute may trigger WPCRule
- FrequencyBand may require ETA evidence
- SKU belongs to Importer/Brand
- Manufacturer may hold BIS registration
- Certificate covers manufacturer, model, standard, and validity
- MarketplaceRule applies to channel and product type
- ChangeEvent affects categories, standards, or evidence requirements

This graph is the moat.

#### Layer 3: Applicability Engine

Goal:

Given a product/SKU and context, return obligations, uncertainty, evidence gaps, and next actions.

Inputs:

- normalized product profile
- country of origin
- intended sales channels
- import mode
- quantity/use case
- manufacturer evidence
- existing certificates

Outputs:

- likely BIS/CRS applicability
- WPC/ETA applicability
- Legal Metrology relevance
- EPR relevance
- marketplace listing requirements
- evidence checklist
- confidence rating
- source citations
- next actions
- advisor notes

Confidence levels:

- Confirmed: source and product facts support the result strongly.
- Likely: product facts indicate applicability, but a missing spec prevents full certainty.
- Possible: rule may apply depending on missing product attributes.
- Unclear: system cannot determine without expert review.
- Not applicable based on supplied facts: source-backed non-applicability with caveats.

Important:

Do not use green/red as "safe/unsafe." Use operational labels:

- Ready for advisor review
- Evidence missing
- High-risk before import
- Marketplace listing risk
- Requires specialist review
- Out of supported scope

#### Layer 4: Monitoring Engine

Goal:

Turn one-time checks into a recurring system.

Monitoring surfaces:

- BIS CRS product list updates
- BIS QCO updates and implementation dates
- WPC/ETA circulars and FAQ changes
- CCPA/e-commerce guidelines
- marketplace policy updates
- Legal Metrology amendments
- CPCB EPR updates
- certificate expiry
- test-report validity/evidence completeness
- model/manufacturer coverage changes

Alert types:

- Rule changed
- New category added
- Deadline approaching
- Document expiring
- Listing evidence missing
- SKU likely affected by new notification
- Source changed but impact unclear
- Manual review required

The key product loop:

1. Customer adds SKUs.
2. ComplyRadar maps them.
3. Customer fixes evidence gaps.
4. ComplyRadar monitors changes.
5. When something changes, affected SKUs are highlighted.
6. Consultant/importer acts.
7. Product becomes the living workspace.

#### Layer 5: Workflow And Collaboration Layer

Goal:

Make professionals use the product repeatedly.

Features:

- bulk SKU upload
- client workspaces
- branded reports
- evidence vault
- checklist generator
- renewal tracker
- task assignment
- report comments
- advisor notes
- audit trail
- status board
- source browser
- export to PDF/Excel
- API later

For consultants, this layer is the product they feel every day. For the company, it is the stickiness layer.

### 4.6 First Product Screens

#### Dashboard

Purpose:

Give a professional a portfolio-level view.

Key components:

- active SKUs
- high-risk SKUs
- evidence-missing SKUs
- alerts this week
- certificates expiring
- reports generated
- clients needing action
- recent source changes

Do not make this a decorative SaaS dashboard. It should be dense, fast, and operational.

#### SKU Intake

Purpose:

Capture enough product information to run applicability logic.

Fields:

- product name
- model/SKU
- product link
- product type
- manufacturer
- supplier
- country of origin
- declared HSN
- import/sale channel
- wireless features
- frequency band if known
- power/battery details
- documents uploaded

UX principle:

Ask only what the system needs. Mark missing fields as "blocks certainty" rather than generic "required."

#### SKU Detail Page

Purpose:

Show one product's compliance profile.

Tabs:

- Overview
- Applicability
- Evidence
- Sources
- Alerts
- Report
- Notes

Important sections:

- normalized product identity
- current risk posture
- applicable obligations
- evidence gaps
- source-backed reasoning
- affected rules
- history of changes
- next actions

#### Report Builder

Purpose:

Generate client-ready outputs.

Report types:

- Pre-import check
- Marketplace listing readiness
- Evidence gap report
- Compliance change impact report
- Consultant handoff report

Report rules:

- every claim cited
- no guarantee language
- no legal opinion language
- uncertainty visible
- next action clear
- source timestamp shown

#### Source Browser

Purpose:

Build trust with power users.

Capabilities:

- view original source
- view extracted fields
- compare source versions
- see parser confidence
- flag extraction issue
- link source to rule

This is crucial because compliance professionals need to inspect the basis of an answer.

### 4.7 Report Language

Allowed language:

- "Based on the product information provided..."
- "This product appears to fall under..."
- "The following evidence appears required..."
- "The supplied documents do not currently show..."
- "Manual confirmation is recommended because..."
- "This finding is based on the following source..."

Prohibited language:

- "Legal to import"
- "Safe to sell"
- "Guaranteed compliant"
- "Customs will clear"
- "Amazon will approve"
- "No issue"
- "Certified"
- "Approved"

The report should reduce ambiguity, not create false certainty.

### 4.8 Accuracy Strategy

Accuracy must be designed, not hoped for.

Mechanisms:

- narrow category scope
- structured source ingestion
- versioned source artifacts
- rule provenance
- confidence labels
- human review path
- consultant feedback loop
- golden test cases
- adversarial examples
- output auditor
- "unknown" as valid output

Every compliance result should have:

- rule id
- source URL/file
- source timestamp
- extraction version
- applicability conditions
- product facts used
- missing facts
- confidence label
- reviewer status

### 4.9 Human-In-The-Loop Strategy

V1 should not be fully autonomous.

Workflow:

1. System produces applicability result.
2. Internal reviewer or design-partner consultant reviews early outputs.
3. Incorrect or ambiguous outputs become training/eval cases.
4. Repeated patterns become deterministic rules.
5. Only stable rules graduate to auto-output.

Human review should be required for:

- high-risk findings
- low-confidence classification
- unsupported product categories
- conflicting sources
- claims of non-applicability
- new regulatory sources
- first 100 real reports

### 4.10 Product-Market Fit Definition

Early PMF is not "many signups."

Early PMF is:

- 5 consultants use it weekly on real client work.
- At least 3 consultants generate reports they actually send to clients.
- At least 2 consultants say they would be upset if it disappeared.
- The tool reduces their first-pass compliance review time by 50%+.
- They add new SKUs without being reminded.
- They ask for client seats, report branding, bulk upload, or alert controls.
- They correct the system with serious feedback instead of abandoning it.

## 5. GTM Strategy

### 5.1 GTM Philosophy

This company should be sold founder-to-founder/operator-to-operator at first.

Do not start with ads.

Do not start with broad SEO.

Do not start with a slick landing page and wait.

Start with domain immersion and design partners.

The first 90 days are not about scale. They are about learning the shape of real work.

### 5.2 First 30 Customer Conversations

Target mix:

- 10 CHAs/customs brokers handling electronics
- 8 BIS/WPC consultants
- 5 electronics importers
- 4 marketplace seller consultants
- 3 D2C electronics/accessory brands

Goal:

Collect real workflows, real documents, real failure cases, and real language.

Ask them:

- Walk me through your last five BIS/WPC queries.
- What information did the client initially provide?
- What was missing?
- Which sources did you check?
- Where did you feel uncertain?
- How did you explain the answer to the client?
- What caused delay?
- What caused disagreement?
- Which products are most confusing?
- What documents do clients misunderstand?
- What does Amazon/Flipkart ask for?
- When do you discover the issue too late?
- What do you charge for this advice?
- What would you never trust software to do?
- What would you happily let software do?

Artifacts to collect:

- anonymized product specs
- old reports
- certificate examples
- test reports
- client WhatsApp queries
- Excel trackers
- marketplace rejection screenshots
- source links consultants use
- report formats

### 5.3 The First Offer

The offer should be concrete:

> "Give me 20 electronics SKUs you recently assessed. I will map them into a dashboard, generate source-backed pre-check reports, and show which ones need evidence, WPC/ETA, BIS/CRS, marketplace listing details, or specialist review."

This avoids abstract pitching.

The CTA:

> "Let's do a 20-SKU pilot."

Not:

> "Book a demo of AI compliance software."

### 5.4 Design Partner Criteria

Accept a design partner only if they agree to:

- share real cases
- join weekly calls
- identify wrong outputs
- generate at least 5 real reports
- explain their current workflow
- give permission for anonymized product learning

Reject or deprioritize:

- curiosity-only users
- consultants afraid to share cases
- users outside electronics/wireless
- customers demanding filing execution from day one
- buyers who want legal guarantees

### 5.5 Founder-Led Sales Motion

Step 1: Research the prospect.

Find:

- what categories they handle
- whether they mention BIS/WPC/ETA
- whether they target importers
- whether they have LinkedIn/IndiaMART/website content

Step 2: Send a precise message.

Example:

> Hi [Name], I am building a SKU-level compliance workspace for electronics importers and BIS/WPC consultants. It maps products like Bluetooth speakers, earbuds, smart watches, cameras, and routers to BIS CRS, WPC/ETA, marketplace listing evidence, and source-backed report outputs. I am not selling broad compliance software. I am looking for 5 consultants/CHAs to test it on 20 real past SKUs and tell me where it is wrong. Would you be open to a 25-minute call?

Step 3: Do not demo first.

Ask them to show their workflow.

Step 4: Offer the 20-SKU pilot.

Step 5: Convert only after they see their own SKU output.

### 5.6 Channel Strategy

#### Channel 1: Direct Consultant/CHA Outreach

Best for first 10 customers.

Sources:

- LinkedIn
- IndiaMART
- consultant websites
- BIS/WPC service pages
- trade association directories
- CHA directories
- customs broker networks

Why it works:

- narrow targeting
- immediate feedback
- buyers understand pain

#### Channel 2: Content For High-Intent Search

Use SEO after domain depth.

Content should not be generic. It should answer specific SKU questions.

Examples:

- "Does a Bluetooth speaker need BIS and WPC approval in India?"
- "WPC ETA requirements for wireless headphones in India"
- "BIS CRS for smart watches in India"
- "Can I import Wi-Fi cameras into India?"
- "Amazon India compliance requirements for radio equipment"
- "ETA details required for e-commerce radio equipment listings"
- "BIS CRS vs WPC ETA for electronics importers"
- "What documents should I ask my Chinese electronics supplier for?"

Each page should have:

- source citations
- product attributes required
- what changes the answer
- "submit your SKU for review" CTA
- no guarantee language

#### Channel 3: Free Tools

Useful lead magnets:

- WPC ETA signal checker
- BIS CRS category lookup
- electronics import document checklist
- SKU evidence-gap checker
- marketplace listing readiness checklist
- "does this product have wireless compliance risk?" intake form

Free tool output should be partial and honest:

> "This product may have WPC/ETA risk because it appears to use Bluetooth. Upload spec sheet/frequency details for a complete review."

#### Channel 4: Marketplace Seller Communities

Use carefully.

Good for pain discovery and inbound, not core monetization at first.

Places:

- Amazon seller forums
- WhatsApp seller groups
- Reddit IndiaBusiness
- LinkedIn comments
- YouTube comments under import/compliance videos

Approach:

- answer specific questions
- show source links
- invite SKU review
- avoid spam

#### Channel 5: Test Labs And Filing Agencies

Potential partners:

- labs that produce test reports
- agencies that file BIS/WPC applications
- legal metrology consultants
- EPR consultants

Pitch:

> "We qualify and structure product inquiries before they become filing work."

Risk:

They may see you as competition. Position as lead qualification and workflow, not replacement.

#### Channel 6: Marketplaces And ERPs

Not day one.

Later pitch:

> "Screen listings/SKUs for regulatory evidence gaps before they become enforcement risk."

The 2025 radio-equipment e-commerce guidelines make this strategically credible.

### 5.7 First 100 Customers Plan

First 5:

- unpaid/low-paid design partners
- weekly feedback
- high-touch onboarding

Next 15:

- paid consultants/CHAs
- ₹8K-₹15K/month
- narrow category scope
- founder support

Next 30:

- importers/D2C brands with SKU portfolios
- case studies from consultant usage
- portfolio monitoring pitch

Next 50:

- mix of consultants and importer/brand subscriptions
- stronger self-serve onboarding
- bulk upload
- repeatable training content

Do not chase 1,000 signups before 20 active professional users.

### 5.8 GTM Metrics

Conversation metrics:

- 30 domain interviews completed
- 20 real SKU cases collected
- 10 design partner candidates
- 5 active design partners

Activation metrics:

- first SKU uploaded
- first report generated
- first report sent to client
- first alert created
- first correction submitted

Retention metrics:

- weekly active consultants
- SKUs added per account
- reports generated per account
- alerts viewed
- evidence gaps resolved
- renewal intent

Commercial metrics:

- pilot-to-paid conversion
- monthly subscription revenue
- consultant expansion
- churn reasons
- support load

Quality metrics:

- false-positive rate
- false-negative rate
- unknown/unclear rate
- source extraction accuracy
- report audit pass rate
- consultant correction rate

### 5.9 Sales Collateral Needed

Minimal collateral:

- one-page founder memo
- 20-SKU pilot offer
- sample SKU report
- sample dashboard screenshot
- source methodology note
- liability/limitations note
- data privacy note

Do not overbuild marketing until the offer works in conversation.

## 6. Claude Code And Codex Implementation Strategy

### 6.1 The AI-Leveraged Founder Operating Model

Claude Code and Codex change the engineering bottleneck, but they do not remove the product bottleneck.

The founder's work shifts:

- less time on boilerplate CRUD
- less time on dashboard scaffolding
- less time on parsers from scratch
- more time on domain source truth
- more time on customer workflow
- more time on eval cases
- more time on distribution
- more time on trust and liability

The correct AI-assisted operating model:

> Founder owns domain truth, product judgment, customer discovery, and acceptance criteria. Claude Code/Codex implement, refactor, test, inspect, and accelerate execution.

Wrong operating model:

> "Ask AI to build a compliance product."

Right operating model:

> "Feed AI precise source schemas, product rules, customer workflows, eval cases, report contracts, and review gates."

### 6.2 Claude Code vs Codex Roles

Use both deliberately.

#### Claude Code

Best for:

- scaffolding modules quickly
- building UI flows
- drafting extraction prompts
- generating parser prototypes
- building admin tools
- writing long-form docs
- creating test data from examples
- implementing broad feature passes
- prototyping source ingestion

#### Codex

Best for:

- repo-native implementation
- precise code edits
- debugging
- tests
- refactoring
- CI/build fixes
- type safety
- review/audit passes
- Playwright verification
- source-controlled product artifacts
- final integration

Working pattern:

1. Founder writes product spec and acceptance tests.
2. Claude Code generates first-pass module.
3. Codex integrates it into repo patterns and hardens tests.
4. Founder reviews outputs against real cases.
5. Codex adds eval cases and guardrails.
6. Claude Code expands adjacent workflows.
7. Codex prevents drift and quality decay.

### 6.3 Recommended Tech Stack

For a solo founder:

- Frontend: Next.js App Router
- Language: TypeScript
- UI: shadcn/ui or equivalent restrained component system
- Database: Postgres via Supabase/Neon
- ORM: Drizzle or Prisma
- Auth: Clerk/Supabase Auth/Auth.js
- Storage: S3-compatible or Supabase Storage
- Queue: Inngest/Trigger.dev/BullMQ depending deployment
- Search: Postgres full-text first, later Meilisearch/Typesense
- Vector search: pgvector if useful, but not as source of truth
- PDF generation: existing ClearDeed PDF patterns if reusable, or React PDF/Playwright PDF
- LLM: structured extraction and report drafting with strict schemas
- Observability: Sentry + structured logs
- Deployment: Vercel for app, worker service for ingestion if needed

Avoid:

- complex microservices too early
- custom agent frameworks too early
- vector-only knowledge base
- autonomous scraping without audit logs
- fully self-serve compliance answers before evals

### 6.4 System Architecture

Core services:

- Web app
- Admin console
- Source ingestion workers
- Document extraction service
- Product normalization service
- Applicability engine
- Monitoring engine
- Report generator
- Output auditor
- Notification service
- API service later

High-level flow:

```text
User uploads SKU/product docs
  -> Product identity extraction
  -> Product normalization
  -> Knowledge graph lookup
  -> Applicability rules run
  -> Evidence gaps generated
  -> Report draft created
  -> Output auditor checks claims/language/sources
  -> Human/professional review if needed
  -> Report published and SKU monitored
  -> Source changes generate affected-SKU alerts
```

### 6.5 Data Model

Minimum tables:

- organizations
- users
- clients
- skus
- sku_documents
- product_types
- product_attributes
- hsn_codes
- regulatory_sources
- source_versions
- extracted_source_facts
- bis_crs_categories
- indian_standards
- qco_notifications
- wpc_rules
- frequency_bands
- marketplace_rules
- evidence_requirements
- certificates
- test_reports
- applicability_rules
- applicability_runs
- findings
- evidence_gaps
- alerts
- reports
- report_sections
- report_audits
- reviewer_feedback
- eval_cases

Critical design choice:

Do not store only generated text. Store structured findings and source links first. Generate text from structured findings.

### 6.6 Source Ingestion Strategy

Source priority:

1. BIS CRS product list
2. BIS products under compulsory certification
3. relevant QCO pages/PDFs
4. WPC/ETA page and circulars
5. 2025 CCPA radio-equipment e-commerce guidelines
6. marketplace public policies where accessible
7. Legal Metrology packaged commodity rules
8. CPCB EPR pages for electronics/batteries/plastics
9. FSSAI and other vertical sources later

For every source:

- capture raw artifact
- store URL
- store fetch timestamp
- store content hash
- store parser version
- extract structured facts
- review first extraction manually
- create fixture
- monitor source changes

Source record fields:

- source_id
- source_type
- regulator
- url
- title
- publication_date
- fetched_at
- effective_date
- raw_artifact_url
- hash
- parser_version
- extraction_status
- review_status
- notes

### 6.7 LLM Usage Rules

Use LLMs for:

- document classification
- table extraction
- product attribute extraction
- spec sheet normalization
- rule explanation drafting
- report narrative drafting
- source-change summarization
- suggested mappings

Do not use LLMs as final authority for:

- whether a regulation applies
- whether a certificate is valid
- whether a product is legally importable
- whether a listing is compliant

Final outputs should come from structured rules plus cited sources. LLMs can explain and summarize, but not invent.

### 6.8 Applicability Engine Design

Start with hybrid rules:

- deterministic rules for known product categories
- structured source mappings
- LLM-assisted product classification
- confidence scoring based on missing attributes
- human review for low-confidence cases

Example pseudo-rule:

```text
IF product_type = "Bluetooth speaker"
AND wireless_protocol includes "Bluetooth"
THEN WPC_ETA_RISK = likely_required
BECAUSE CCPA radio equipment guidelines reference Bluetooth/Wi-Fi devices requiring ETA details for listing,
AND DoT ETA page covers speakers/short-range devices in licence-exempt bands.
REQUIRED_FACTS = frequency_range, test_report, ETA certificate/details, model/manufacturer match.
```

Rule object:

- rule_id
- version
- name
- conditions
- required_product_facts
- source_ids
- output_finding
- confidence_logic
- uncertainty_behavior
- reviewer_required
- effective_date
- superseded_by

### 6.9 Output Auditor

Every generated report should pass an output auditor.

Auditor checks:

- no prohibited language
- every claim has source
- confidence labels visible
- no unsupported legal conclusion
- no false certainty
- no missing disclaimer
- no contradiction between sections
- no source older than expected without warning
- no "not applicable" without conditions

Auditor output:

- pass/fail
- violations
- required edits
- severity
- blocked report sections

### 6.10 Evaluation Strategy

Build evals from day one.

Eval categories:

- known BIS CRS applicable products
- known WPC/ETA likely products
- products with missing wireless specs
- products with ambiguous category
- products outside scope
- marketplace listing evidence cases
- certificate/model mismatch cases
- source-change impact cases

Each eval case includes:

- product input
- documents
- expected normalized attributes
- expected findings
- acceptable uncertainty
- prohibited findings
- source requirements

Acceptance metric:

The system is allowed to say "unclear." It is not allowed to confidently say the wrong thing.

### 6.11 Security And Compliance

Handle:

- customer documents
- invoices
- supplier details
- product plans
- test reports
- certificates
- client data

Minimum requirements:

- organization-level data isolation
- signed URLs for files
- audit logs
- encrypted storage
- access roles
- no training on customer data without permission
- clear data retention policy
- private-by-default reports

### 6.12 Anti-Hallucination Rules

Product rules:

- "Unknown" is a valid answer.
- "Manual review required" is a valid answer.
- Every obligation must map to a source.
- Every source must have a timestamp.
- Every non-applicability claim must show conditions.
- Every generated report must be reproducible.

Engineering rules:

- schemas before prompts
- tests before broad expansion
- fixtures for each source
- source snapshots retained
- parser drift detected
- output auditor required

### 6.13 Development Phases

#### Phase 0: Domain Workspace

Build:

- source library
- manual SKU spreadsheet
- report template
- interview CRM
- sample evidence vault

Do not overbuild. The goal is to learn.

#### Phase 1: Internal Console

Build:

- SKU intake
- document upload
- manual product normalization
- source-backed finding entry
- PDF report generation
- basic report audit

This supports concierge pilots.

#### Phase 2: Semi-Automated Applicability

Build:

- product extraction from docs/links
- BIS CRS mapping
- WPC/ETA mapping
- evidence gap generation
- confidence labels
- review queue
- consultant-facing report

#### Phase 3: Portfolio Monitoring

Build:

- active SKU dashboard
- source monitoring
- change detection
- affected-SKU matching
- alert workflow
- email/WhatsApp digest
- certificate expiry tracking

#### Phase 4: Consultant Workflow

Build:

- client workspaces
- white-label reports
- bulk upload
- comments/notes
- task lists
- client portal
- team roles

#### Phase 5: API

Build:

- SKU check endpoint
- listing pre-check endpoint
- evidence requirement endpoint
- webhook alerts
- marketplace/ERP pilots

## 7. 90-Day Plan

### Days 1-21: Domain Immersion

Primary goal:

Become dangerous in one domain: wireless/electronics compliance in India.

Actions:

- interview 30 target users
- collect 50 real SKU examples
- collect 20 real reports/checklists if possible
- read BIS CRS product list
- read WPC/ETA docs and FAQs
- read 2025 CCPA e-commerce radio-equipment guidelines
- map 20 common electronics products manually
- identify 5 design partners
- find 1 advisor with BIS/WPC/CHA depth

Output:

- interview notes
- customer language map
- 20-SKU manual compliance map
- first report template
- first source matrix
- first product taxonomy

Success:

- You can explain the workflow better than a generic consultant.
- Prospects say "yes, that is exactly the issue."
- You have real SKU data, not hypothetical examples.

### Days 22-45: Knowledge Graph V0

Primary goal:

Build structured truth for a narrow vertical.

Actions:

- create source ingestion schemas
- ingest BIS CRS list
- define 20 product types
- map product types to likely obligations
- ingest WPC/ETA page and relevant circulars/FAQs
- ingest CCPA 2025 radio equipment guidelines
- define evidence requirements
- create eval cases
- create rule objects
- create internal SKU workspace

Output:

- product taxonomy
- source table
- rule table
- evidence table
- 50 eval cases
- internal dashboard

Success:

- You can run 20 real SKUs through the system and produce structured findings.
- At least one domain advisor says the structure is directionally useful.

### Days 46-70: Consultant MVP

Primary goal:

Make the system useful enough for design partners.

Actions:

- build SKU intake
- build document upload
- build report generator
- build review queue
- build output auditor
- build branded PDF
- build source citations
- onboard 5 design partners

Output:

- consultant workspace
- sample reports
- review workflow
- first real reports sent to users

Success:

- 5 consultants/CHAs/importers upload real SKUs.
- At least 3 use generated outputs in real work.
- At least 20 corrections are captured and converted into eval cases.

### Days 71-90: Monitoring MVP

Primary goal:

Prove recurring value.

Actions:

- create active SKU list
- monitor key source pages manually/automatically
- create change events
- map changes to affected SKUs
- send weekly digest
- add certificate/evidence expiry tracking
- convert 2-3 design partners to paid pilots

Output:

- monitoring dashboard
- alert emails
- change-impact report
- paid pilot agreements

Success:

- Users care about alerts.
- Users keep SKUs in the system.
- 2-3 users pay or commit to paying.

## 8. 12-Month Roadmap

### Months 1-3

Theme:

Domain truth and consultant MVP.

Milestones:

- 30 interviews
- 5 design partners
- 100 SKUs analyzed
- 100 eval cases
- internal knowledge graph
- first paid pilot

### Months 4-6

Theme:

Paid consultant workflow.

Milestones:

- 10-20 paid consultant/CHA accounts
- ₹1L-₹3L MRR
- 500 active SKUs
- weekly monitoring digest
- white-label reports
- advisor network

### Months 7-9

Theme:

Importer/brand portfolio.

Milestones:

- 5-10 importer/brand customers
- 2,000 active SKUs
- evidence vault
- certificate expiry tracking
- bulk upload
- case studies
- ₹5L-₹8L MRR

### Months 10-12

Theme:

Expansion and API proof.

Milestones:

- 5,000 active SKUs
- marketplace listing pre-check prototype
- API design partner
- more categories within electronics/small appliances
- ₹10L+ MRR target if execution is strong
- documented accuracy metrics

Do not expand into unrelated verticals until the first vertical has real retention.

## 9. Operating Cadence

### Weekly Founder Schedule

In the first 90 days:

- 40% customer/domain discovery
- 30% product/data modeling
- 20% engineering with Claude/Codex
- 10% GTM/content/admin

After early pilots:

- 30% customer success/sales
- 30% product/data quality
- 25% engineering
- 15% GTM/process

If engineering consumes 70%+ of your time after week 3, you are likely hiding in the easy part.

### Weekly Rituals

Monday:

- review active pilots
- pick top 3 product risks
- pick top 3 source/data tasks

Tuesday-Wednesday:

- customer calls
- domain/source work
- product implementation

Thursday:

- QA/evals
- review corrections
- update knowledge graph

Friday:

- ship improvements
- send weekly digest to design partners
- write one public/source-backed content piece

### Decision Gates

Day 21 gate:

- Do 5+ serious prospects confirm this pain?
- Do you have real SKU cases?
- Are you energized by the domain?

Day 45 gate:

- Can you map 20 SKUs with source-backed reasoning?
- Is the knowledge graph structure working?

Day 70 gate:

- Are design partners using it on real work?
- Are corrections actionable?

Day 90 gate:

- Will anyone pay?
- Does monitoring matter?
- Is consultant-first still right?

## 10. Team And Advisor Strategy

### 10.1 Solo Founder Reality

You can build the software solo. You should not build the domain understanding solo.

You need at least one close advisor:

- ex-BIS/WPC/compliance professional
- senior CHA
- electronics import consultant
- marketplace compliance operator
- product testing lab operator

Offer:

- small equity/advisor grant
- structured monthly sessions
- review of reports
- introduction to design partners

### 10.2 First Hires Or Contractors

Do not hire engineers first.

First non-founder help:

- regulatory research analyst
- operations/review associate
- domain consultant reviewer
- customer success operator

Engineering can remain founder + AI-assisted longer than domain review can.

### 10.3 Expert Review Board

Create informal review board:

- one BIS/WPC consultant
- one CHA
- one marketplace seller consultant
- one electronics importer

Use them to review:

- product taxonomy
- report language
- source interpretations
- edge cases
- pricing

## 11. Risk Register

### 11.1 Accuracy Risk

Risk:

Wrong compliance outputs can harm customers.

Mitigation:

- narrow scope
- source citations
- confidence labels
- human review
- output auditor
- no guarantee language
- professional workflow positioning
- eval cases

### 11.2 Liability Risk

Risk:

Customers mistake output for legal/certification guarantee.

Mitigation:

- no "compliant/legal/safe" language
- report limitations
- advisor review
- terms of service
- disclaimers in UI and PDFs
- insurance later

### 11.3 Consultant Adoption Risk

Risk:

Consultants see product as competitor.

Mitigation:

- white-label reports
- lead qualification
- workflow tool
- client portal
- do not offer filing services at first
- position as "your research/reporting assistant"

### 11.4 Data Source Fragility

Risk:

Government pages change or are hard to parse.

Mitigation:

- raw artifact storage
- versioned parsers
- human review
- official-source monitoring
- source health dashboard
- manual fallback

### 11.5 Broadness Risk

Risk:

Founder tries to cover too many verticals.

Mitigation:

- lock first vertical
- expansion gates
- SKU count/retention metrics before expansion

### 11.6 AI Wrapper Risk

Risk:

Incumbents copy the interface.

Mitigation:

- data graph
- workflow depth
- consultant network
- eval dataset
- source version history
- SKU portfolio monitoring
- API integrations

### 11.7 Founder Burnout Risk

Risk:

Compliance domain work is dense and slow.

Mitigation:

- test personal interest before commitment
- advisor network
- clear weekly cadence
- narrow milestones
- avoid endless generic research

## 12. What Not To Build

Do not build in the first 90 days:

- mobile app
- full self-serve checkout
- all-India/all-product compliance chatbot
- filing marketplace
- legal opinion generation
- autonomous certification agent
- broad regulatory news dashboard
- enterprise API
- multi-country coverage
- fancy landing page

Build only what helps:

- understand the domain
- map real SKUs
- generate trusted reports
- create recurring monitoring
- get consultants to use it

## 13. First 20 Product Types To Map

Start with:

1. Bluetooth speaker
2. Wireless headphones
3. TWS earbuds
4. Smart watch
5. Smart speaker
6. Wi-Fi router
7. Wireless keyboard
8. Wireless mouse
9. Webcam
10. CCTV camera
11. Power bank
12. USB charger/adaptor
13. LED lamp
14. LED driver
15. Mini thermal printer
16. Wireless microphone
17. POS terminal
18. Tablet
19. Mobile phone
20. IoT sensor/gateway

For each:

- product definition
- common HSN candidates
- BIS CRS relevance
- WPC/ETA relevance
- Legal Metrology relevance
- EPR relevance
- marketplace evidence
- common supplier-document gaps
- source links
- uncertainty conditions

## 14. Sample Output For A SKU

Input:

- Product: Bluetooth speaker
- Imported from: China
- Sales channel: Amazon India + own website
- Documents: supplier catalogue only
- Wireless: Bluetooth 5.3 claimed
- Frequency: not provided
- Model number: SPK-X7

Output summary:

- Product appears to have radio/wireless functionality.
- WPC/ETA applicability is likely, but frequency and test-report details are missing.
- Marketplace listing may require ETA details, frequency ranges, and test report evidence under the 2025 radio-equipment e-commerce guidelines.
- BIS CRS applicability depends on exact product classification and current BIS CRS category mapping.
- Legal Metrology declarations may be relevant if sold as pre-packaged commodity.
- EPR may be relevant depending on electronics/battery and brand/importer role.
- Required next documents: technical spec sheet, frequency range, ETA certificate/details if available, test report, manufacturer details, model coverage evidence, packaging label draft, importer details.
- Status: high-risk before listing/import until evidence is collected.

Notice what this does:

- It is actionable.
- It is source-backed.
- It does not say "legal" or "illegal."
- It tells the consultant/importer what to ask for next.

## 15. Brand And Messaging

### 15.1 Name

ComplyRadar is acceptable but slightly generic. It signals monitoring, which is good.

Possible positioning phrases:

- SKU compliance radar for Indian electronics commerce
- Product compliance intelligence for importers and advisors
- Monitor every SKU for BIS, WPC, ETA, and listing risk
- The product-compliance graph for Indian commerce

### 15.2 Messaging Hierarchy

Primary:

> Monitor every electronics SKU for Indian compliance risk.

Secondary:

> ComplyRadar maps your products to BIS, WPC/ETA, marketplace evidence, labeling, and source-backed obligations before they become shipment or listing problems.

For consultants:

> Generate source-backed client reports in minutes and monitor every client SKU for regulatory changes.

For importers:

> Know which SKUs are missing compliance evidence before import, listing, or enforcement.

For marketplaces/API later:

> Screen product listings for regulatory evidence gaps before they become compliance exposure.

### 15.3 Avoid These Claims

Avoid:

- "Get certified"
- "Guaranteed approval"
- "Import without risk"
- "AI lawyer"
- "100% compliance"
- "Avoid customs hold guaranteed"

## 16. Source And Evidence Methodology

Every source-backed finding should answer:

- Which source?
- Which version?
- Which date?
- Which product fact triggered this?
- What evidence is missing?
- What confidence level?
- What changed recently?
- What should the user do next?

Source reliability tiers:

| Tier | Source | Use |
|---|---|---|
| Tier 1 | Official regulator source, Gazette, circular, rule | Can support findings |
| Tier 2 | Official portal FAQ/process page | Can support procedural findings |
| Tier 3 | Marketplace policy page | Can support listing workflow |
| Tier 4 | Consultant/lab article | Context only, never final authority |
| Tier 5 | Forum/Reddit/user posts | Pain discovery only |

Never let Tier 4 or Tier 5 sources determine compliance output.

## 17. Investor Narrative

The strong investor narrative:

> Indian commerce is becoming compliance-constrained at SKU level. Today, product compliance knowledge lives in consultants, PDFs, portals, and spreadsheets. ComplyRadar is building the structured product-compliance graph for India, starting with wireless/electronics where BIS, WPC/ETA, and marketplace enforcement create urgent recurring pain. Consultants and CHAs are the wedge; SKU monitoring for importers and brands is the recurring revenue engine; marketplace/API checks are the infrastructure outcome.

The "why now":

- regulatory enforcement is increasing
- e-commerce listing accountability is increasing
- AI makes source ingestion and extraction possible with a small team
- SMEs are digitizing but compliance remains manual
- high-SKU commerce needs monitoring, not just filing

The "why you":

- solo founder with AI-assisted build leverage
- ClearDeed-like ability to turn fragmented public records into structured risk reports
- willingness to build deep data layer and liability-aware workflows

The "why wedge":

- wireless/electronics has cross-regime complexity, repeated SKU volume, and high economic pain

## 18. Final Recommendation

I would pursue this idea, but only with discipline.

The company should start as:

> **A consultant-first compliance workspace for Indian wireless/electronics SKUs.**

The business should become:

> **Continuous SKU compliance monitoring for importers, D2C brands, and marketplace sellers.**

The long-term infrastructure play should be:

> **An India product-compliance graph and API for commerce platforms.**

The one-time report should exist, but only as a wedge:

> "Send us 20 SKUs. We will show you which ones have BIS/WPC/ETA/listing evidence risk."

The core strategy:

1. Go narrow.
2. Go deep.
3. Sell to professionals first.
4. Build the SKU graph as the moat.
5. Turn one-time checks into monitoring.
6. Use Claude Code/Codex to move fast, but use domain experts and evals to stay true.

The biggest strategic warning:

> If you do not enjoy reading regulatory documents, source pages, circulars, and edge cases, do not build this company.

The biggest strategic encouragement:

> If you do enjoy that work, this is one of the rare solo-founder opportunities where AI coding leverage can turn a boring, fragmented, regulation-heavy workflow into a real B2B data infrastructure company.

## 19. Immediate Next Actions

This week:

1. Create a list of 50 CHAs/BIS/WPC consultants/electronics importers.
2. Schedule 10 calls.
3. Read the BIS CRS product list end to end.
4. Read the WPC ETA page and FAQ/circulars.
5. Read the 2025 CCPA radio-equipment e-commerce guidelines.
6. Manually map 10 electronics SKUs.
7. Draft a one-page 20-SKU pilot offer.

Next week:

1. Complete 10-15 interviews.
2. Collect 20 real SKU examples.
3. Build a manual compliance matrix in a spreadsheet.
4. Identify 3 design partners.
5. Draft the first source-backed report template.

Only after this:

1. Build the internal console.
2. Build the knowledge graph schema.
3. Build the first report generator.

The sequence matters. Domain first. Product second. Automation third. Scale last.

