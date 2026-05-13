# Source: ORERA — Odisha Real Estate Regulatory Authority

Last verified: 2026-05-01
Status: PROBE COMPLETED — builder/project search is complex, no direct party search
Owner module: N/A

## What it returns
RERA (Real Estate Regulatory Authority) provides information about registered real estate projects, builders (promoters), and agents. It helps verify if a builder is authorized to sell and if a project is legally registered.

## Access and URL
- Primary portal: `https://rera.odisha.gov.in`
- Previous known backend endpoints (e.g., `odisha.verasai.in`) appear to be unresolved or deprecated.

## Access level
- **Public search**: The site has a public "Online Project List" and "Project Progress" sections.
- **Login required**: Generally not required for viewing public lists, but detailed registration documents might require specific navigation.
- **Captcha**: Some state RERA portals use captchas for search, though the main lists might be accessible. 

## Build assessment for builder/project search
- **Builder name search**: Not directly exposed as a simple text search from the homepage. Users typically have to navigate the "Online Project List" and filter or search within the table.
- **Project search by location**: Also challenging without knowing the exact project name or promoter. The data is often structured around the Project Registration Number.
- **Party search (individual seller)**: RERA is for builders/promoters, not individual resale sellers. It cannot be used to verify individual secondary market sellers.

## Result and functional status
- Functional status: The portal is live and returns HTTP 200.
- Data schema: Projects are listed under "Online Project List". It likely involves downloading PDFs or viewing large HTML tables. Full automation would require scraping the project list and indexing it.
- **Conclusion**: RERA is primarily useful for *new* properties or builder verification. For ClearDeed's V1 focus on individual/resale plots, RERA provides limited value unless the seller is a developer. Building a live fetcher is low priority until we target builder properties. We will use a stub/deep-link approach if the seller is identified as a company/builder.