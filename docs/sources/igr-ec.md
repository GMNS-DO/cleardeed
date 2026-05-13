# Source: IGR Odisha — Encumbrance Certificate (EC)

Last verified: 2026-04-30 (probe assessment)
Status: PROBE NEEDED — not yet automated, not yet live-validated
Owner module: N/A (concierge add-on candidate)

## What it returns

An Encumbrance Certificate (EC) is the official proof that a property has no registered transactions (sale deeds, mortgages, leases, gifts) affecting it during a given period. It is the primary source for verified transaction history. It does NOT cover:
- Mutation (revenue record update) — that is Bhulekh's job
- Equitable mortgages or charges registered with CERSAI but not with the SRO
- Possession-based or oral transactions
- Genealogical/heirship claims not backed by a registered deed

## Access and URL

The primary government portal for Odisha registration services is:
- **igrodisha.gov.in** — official website of the Inspector General of Registration, Odisha
- The online EC application process typically routes through **registrationodisha.gov.in** or sub-registrar office portals

Key endpoints commonly referenced:
- `https://igrodisha.gov.in` — main IGR Odisha portal
- `https://registrationodisha.gov.in` — document registration portal (may host NGDRS-based search)

Note: The exact current URL for online EC search needs live verification. Government portals in this category frequently change or require navigation through multiple steps.

## Access level

- **Public search**: A basic property description search may be available without login, but the actual certified EC requires login and fee payment.
- **Login required**: Most EC certificate retrieval and application flows require registration on the portal or a valid user account.
- **Fee**: EC issuance involves government fees (typically a small fixed fee plus per-page or per-transaction charges). Fee structure should be confirmed from current official sources.

## What data is returned

A certified EC contains:
- Period of search (from/to dates)
- List of all registered documents affecting the property during that period
- For each entry: document type (sale deed, mortgage, lease, gift deed, etc.), document number/date, parties names, property description, consideration/value
- SRO (Sub-Registrar Office) name and jurisdiction

Important limitation: EC covers registered documents only. An EC showing "no encumbrance" means no registered transactions — not that the property is unencumbered in a broader sense.

## EC application workflow (typical offline + partial online process)

Based on general knowledge of Odisha IGR process:

1. **Identify the correct SRO**: The SRO jurisdiction must match the property's location. SRO boundaries in Odisha do not map 1:1 to tahasils (this is a known gap — DPR-LOC-003).
2. **Determine the search period**: Standard practice is to search from the date of first registration or the earliest available record (often going back 30+ years for older properties).
3. **Submit application**: Application can be submitted physically at the SRO or through the online portal.
4. **Pay fees**: Government fees for EC search and issuance.
5. **Collect EC**: Physical EC is collected from SRO or sent digitally if the portal supports it.

## Current ClearDeed status

V1 provides manual EC instructions only. The report's EC section generates:
- A pre-filled deep-link URL (when district and SRO are known)
- Step-by-step instructions for physical EC application
- Explicit disclaimer that EC has not been pulled or verified by ClearDeed

This is intentional — ClearDeed does not purchase or retrieve the EC in V1.

## Build assessment for concierge add-on

**Can it be built as a concierge add-on? YES — with important caveats.**

A concierge EC add-on means a ClearDeed human operator assists the buyer by:
1. Preparing the pre-filled EC application with correct SRO, search period, and property details
2. Guiding the buyer through the physical or online application process
3. Reviewing the retrieved EC document and surfacing relevant findings

This is viable because:
- The buyer or a representative must appear at the SRO or authenticate on the portal — full automation is legally and practically difficult without special access
- Fee payment and document retrieval require human involvement
- EC review (interpreting the entries) benefits from human judgment
- The main ClearDeed value-add is preparing the application details (property description, survey/khata/plot numbers, owner names) so the buyer arrives at the SRO with correct inputs

**What would make full automation harder**:
- Portal authentication and session management
- Fee payment automation
- Document download/parsing (EC is often a scanned PDF or physical document)
- SRO-to-tahasil resolution (DPR-LOC-003 pending)

## Failure modes

- **Wrong SRO**: If the property falls in a different SRO jurisdiction than assumed, the EC will be incomplete or rejected.
- **Search period too short**: If the buyer requests EC for too short a period, older encumbrances will be missed.
- **Online portal unavailable**: Government portals may be down; physical SRO visit may be the only path.
- **Fee payment failure**: Online payment may fail or the fee structure may have changed.
- **Document not yet digitized**: Older ECs may need physical retrieval.

## Manual verification fallback

1. Visit the nearest Sub-Registrar Office (SRO) for the property's jurisdiction.
2. Submit an EC application with: property details (survey number, khata number, plot number, village, tahasil), owner name, and search period.
3. Pay the prescribed government fee.
4. Collect the EC on the specified date.
5. For online path: check igrodisha.gov.in or registrationodisha.gov.in for current online EC services.

## Key open questions for next probe session

1. What is the current live URL for online EC search/application in Odisha?
2. Is there a public (no-login) EC search, or is login required even for the initial search?
3. What is the current fee structure for EC issuance?
4. Does the portal support digital EC download, or is it physical-only?
5. Is there an SRO-to-district/tahasil mapping document available?
6. Does the IGR portal expose an Index-II search (transaction history by property) or only certified copy request?
