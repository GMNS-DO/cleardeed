# Source: CERSAI — Central Registry of Securitisation Asset Reconstruction and Security Interest

Last verified: 2026-04-30 (probe assessment)
Status: PROBE NEEDED — not yet automated, not yet live-validated
Owner module: N/A (concierge paid add-on candidate, DPR-ENC-005)

## What it returns

CERSAI (Central Registry of Securitisation Asset Reconstruction and Security Interest of India) is a centralized registry maintained under the SARFAESI Act, 2002. It records security interests (charges/mortgages) created by banks, financial institutions, and NBFCs over immovable properties across India.

**Key value for ClearDeed**: CERSAI catches equitable mortgages and registered charges that may NOT appear in the SRO EC. A seller may have taken a loan from a bank using the property as collateral, and this charge is registered with CERSAI but not always with the local SRO — especially for equitable mortgages where physical possession is not transferred.

An EC search through IGR shows only registered documents. CERSAI adds the layer of charges registered with financial institutions that may not have a separate SRO registration.

## Access and URL

- **cersai.org.in** — official CERSAI portal
- The public-facing search interface is typically at `https://www.cersai.org.in` — a search page exists for party name and property searches

The portal is run by the Central Registry of Security Interest (CERSAI), which is a separate body from the IGR (state-level registration).

Note: The exact current URL for public search needs live verification. Government digital services in this category change frequently.

## Access level

- **Public search**: CERSAI has a public search interface for searching charges by party name and property details.
- **No login required for basic search**: The search page is publicly accessible.
- **Fee**: There is no fee for public search queries. The fee applies to registered users filing new charge creation or satisfaction applications (for banks/FIs).
- **Authentication for filing**: Only banks, financial institutions, and authorized users register with CERSAI to file charge creation/satisfaction applications. This is NOT a fee for buyers.

## What data is returned

A CERSAI search by party name (seller/owner name) returns:
- List of charges/mortgages registered with CERSAI against that party
- For each entry: charge type (mortgage, hypothecation, etc.), property description, borrower/chargor name, secured creditor (lender), charge creation date, charge amount, charge status (active/satisfied)
- Charge status: **Active** means the mortgage is still outstanding; **Satisfied** means it has been paid and the charge has been removed

**Important**: CERSAI records charges created by financial institutions. It does NOT cover:
- Private loans between individuals (not registered with any FI)
- Oral or unregistered mortgages
- Possessory mortgages not registered with CERSAI

## Search workflow

Typical CERSAI public search flow:

1. Go to `cersai.org.in`
2. Navigate to the "Search" or "Public Search" section
3. Enter the **party name** (seller's name as registered with CERSAI — typically the person who created the mortgage with a bank)
4. Optionally filter by property description or date range
5. View results — each row shows charge details and current status
6. Download or note the relevant entries

The search is by party name, so it requires knowing who the borrower/chargor is (the seller, or any entity that created a charge over the property).

**Limitations**: The seller may have taken loans under different name spellings. CERSAI search relies on the name being registered correctly. Transliteration variants (Odia script to Roman) may affect search results.

## Current ClearDeed status

V1 does not include any CERSAI lookup. This is listed as a **P0 priority** in the source roadmap because it catches a fraud pattern that SRO EC alone cannot detect: the seller has a live mortgage with a bank that is registered with CERSAI but does not appear in the local EC.

## Build assessment for concierge add-on

**Can it be built as a concierge add-on? YES — more so than IGR EC, but with name-variant caveats.**

A concierge CERSAI add-on is more feasible than IGR EC because:
1. The search is public and free — no login or fee required
2. The search is name-based — it can be done with the seller's name (as extracted from Bhulekh or the buyer-provided claim)
3. Results are structured (tabular) — easier to parse and interpret
4. Active charges against the seller are high-confidence fraud indicators
5. No SRO jurisdiction to navigate — CERSAI is centralized

**What makes full automation harder**:
- Name transliteration: CERSAI likely expects standard Romanized names. Odia-script Bhulekh owners may need A5 transliteration before search.
- Name variants: Searching one spelling may miss variations. Best to run multiple transliteration variants.
- Search rate limits: Unknown. May need throttling.
- Interpreting "active" vs "satisfied" requires understanding the SARFAESI context.

**Build sequence recommendation**:
1. First implement as a concierge add-on: operator runs CERSAI search using Bhulekh owner name + transliteration, reviews results, and reports findings
2. Once confidence is established, automate the name search (with variant generation) and result parsing
3. Flag: active CERSAI charge + seller non-disclosure = hard banner finding

## Failure modes

- **Name not found in CERSAI**: A zero-result on CERSAI search is a valid negative — it means no charge was registered by a financial institution under that exact name spelling. This is not a guarantee of no encumbrance (private loans exist outside CERSAI).
- **Name variant mismatch**: If the borrower's name in CERSAI uses a different spelling, the search may return false zero results. Run Dice-coefficient or Levenshtein-based variant generation.
- **Seller not the borrower**: CERSAI searches by party name. If the seller is a company/LLP, search must be by entity name. If the seller is an individual, search by personal name. Searching the wrong entity produces false negatives.
- **Charge satisfied but not removed**: Some satisfied charges remain in the register for a period. Distinguish active vs satisfied.
- **Portal unavailable**: CERSAI may have downtime. Fail gracefully and note as incomplete.

## Manual verification fallback

1. Go to `cersai.org.in`
2. Click "Search" or "Public Search"
3. Enter seller/owner name (use Bhulekh transliterated name or buyer-provided name)
4. Review results: active charges are highlighted or marked as "Open" — these require further investigation
5. Check whether the seller has disclosed any active mortgage — if not, this is a hard flag requiring legal review
6. For company/LLP sellers: search by entity name (DIN-based search if available)

## Key open questions for next probe session

1. What is the current live URL for CERSAI public party search?
2. Is the search form accessible without login? What fields are available?
3. Does CERSAI support search by property description (survey/khata/plot), or only party name?
4. What is the response format — HTML table, downloadable PDF, or API?
5. Does CERSAI expose any API, or is scraping the only automation path?
6. Is there a bulk search option for running multiple name variants?
7. What name transliteration/variant strategy works best for Odia-script Bhulekh owners?
8. Are there CERSAI public search terms and conditions that restrict automated queries?
