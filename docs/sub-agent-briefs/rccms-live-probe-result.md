# RCCMS Live Probe Result

## What was produced
Definitive findings document at `docs/sources/rccms.md` covering the RCCMS URL structure, authentication requirements, search mechanism, and blockers. Updated fetcher at `packages/fetchers/rccms/src/index.ts` with accurate documentation and the correct `not_implemented` status.

## What was attempted
1. Probed `rccms.ori.nic.in` via curl — **DNS resolution failed** (host unreachable from external network).
2. Probed `rccms.odisha.gov.in` and `rccms.nic.in` — same DNS resolution failure.
3. Found the actual RCCMS portal: `https://bhulekh.ori.nic.in/rccms/` (hosted under the Bhulekh domain).
4. Fetched the login page and case status page to understand the form structure and search capabilities.

## Key findings
- **RCCMS is behind a login wall.** No public party-name search exists. Credentials + captcha are required.
- **The search mechanism is entirely case-number driven.** There is no field for party name, owner name, khata number, plot number, or village. Court Type → Court Name → Case Type → Case No → submit.
- **Authentication uses double-MD5 password hashing + captcha.** Even with credentials, captcha solving is required.
- **No automatable party search path exists.** For ClearDeed's use case (given GPS + owner name, find revenue court cases), RCCMS cannot help because there is no party-name search field.
- The appropriate channel for party-name court searches is `services.ecourts.gov.in` (eCourts), which is already implemented.

## What was abandoned
Building a live automated RCCMS fetcher was abandoned because:
1. No party-name search exists on the portal — this is a fundamental architectural mismatch with ClearDeed's use case.
2. Authentication with captcha is required even for the simplest case-number lookup.
3. Even with credentials, the workflow requires cascading dropdown selections (each an ASP.NET AJAX postback), making simple HTTP requests insufficient.
4. Revenue court cases tied to a specific plot/owner would be found via eCourts or the Orissa High Court, not via RCCMS which requires knowing the case number first.

## New questions raised
- Should the report clarify that eCourts + Orissa High Court are the court search channels for title due diligence (replacing any implication that RCCMS covers this)?
- Should a conditional RCCMS case-status lookup be added as a concierge/manual step when Bhulekh surfaces a mutation case reference?
- Is there a separate Tahasildar court case portal that supports party-name search? (No evidence found, but worth noting for future research.)
