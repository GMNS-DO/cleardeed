#!/usr/bin/env node

import { RawArchive, absolutizeUrl, decodeHtml, fetchBuffer, inferArtifactType, safeSlug, utcDateStamp } from "../lib/raw-archive.mjs";

const SOURCE_GROUPS = [
  {
    sourceId: "orissa_high_court_public",
    label: "Orissa High Court public judgments/orders",
    sourceClass: "wave2_public_pdf",
    pages: [
      {
        artifactId: "vernacular-judgments-index",
        url: "https://www.orissahighcourt.nic.in/vernacular_judgments/",
        notes: "Official High Court judgments index; large HTML page with judgment PDF links.",
      },
      {
        artifactId: "site-search-page",
        url: "https://www.orissahighcourt.nic.in/search.php",
        notes: "Official High Court site search page for manual keyword discovery.",
      },
    ],
    seedDocs: [
      {
        artifactId: "cmp-1094-2022-sale-deed-dispute",
        url: "https://orissahighcourt.nic.in/uploads/vernacular_judgements/hc_judgements/CMP_1094_2022_e.pdf",
        notes: "Sample order mentioning suit land and sale deed challenge.",
      },
      {
        artifactId: "cmp-1292-2023-partition-sale-deed",
        url: "https://orissahighcourt.nic.in/uploads/vernacular_judgements/hc_judgements/CMP_1292_2023_e.pdf",
        notes: "Sample order mentioning partition and registered sale deed challenge.",
      },
      {
        artifactId: "wpc-15022-15020-2022-acquisition-sale-deed",
        url: "https://orissahighcourt.nic.in/uploads/vernacular_judgements/hc_judgements/WP%28C%29_15022%20%26%2015020_2022_e.pdf",
        notes: "Sample writ mentioning land acquisition and sale deed execution issues.",
      },
    ],
    linkFollow: {
      fromArtifactId: "vernacular-judgments-index",
      maxDocs: 2,
      include: /hc_judgements\/.*\.pdf/i,
      notes: "First few judgment PDFs linked from official index for repeatability check.",
    },
  },
  {
    sourceId: "bda_planning_zoning",
    label: "BDA planning/zoning/static regulatory pages",
    sourceClass: "wave2_static_regulatory",
    pages: [
      {
        artifactId: "bda-notice-index",
        url: "https://www.bda.gov.in/notice",
        notes: "BDA public notice index; includes planning/regulatory downloadable notices.",
      },
      {
        artifactId: "bda-planning-department",
        url: "https://bda.gov.in/bda/department/planning-department",
        notes: "BDA planning department page with CDP/zoning/map/report references.",
      },
      {
        artifactId: "bda-maps-reports",
        url: "https://bda.gov.in/bda/downloads/maps-reports",
        notes: "BDA maps/reports landing page when accessible.",
      },
    ],
    seedDocs: [
      {
        artifactId: "bdpa-proposed-landuse-large-map",
        url: "https://cms.bhubaneswarone.in/uploadDocuments/content/Proposed-Landuse-of-BDPA-large.jpg",
        notes: "Planning page linked proposed land-use image; useful for zoning-map handling sample.",
      },
    ],
    linkFollow: {
      fromArtifactId: "bda-notice-index",
      maxDocs: 3,
      include: /uploadDocuments\/Notice\/.*\.(pdf|jpg|jpeg|png)$/i,
      notes: "First few BDA notice downloads from official notice page.",
    },
  },
  {
    sourceId: "bank_auction_public_notices",
    label: "Bank/development-authority auction and sale notices",
    sourceClass: "wave2_financial_distress_notice",
    pages: [
      {
        artifactId: "oshb-notices",
        url: "https://oshb.org/news-category/notices/",
        notes: "Odisha State Housing Board notices; contains e-auction/sale notice examples.",
      },
      {
        artifactId: "oshb-e-auction",
        url: "https://oshb.org/e-auction/",
        notes: "OSHB e-auction landing page.",
      },
      {
        artifactId: "bda-auction-page",
        url: "https://www.bda.gov.in/tender/auction",
        notes: "BDA auction tender page.",
      },
    ],
    seedDocs: [],
    linkFollow: {
      fromArtifactId: "oshb-notices",
      maxDocs: 4,
      include: /(e-auction|auction|Sale-of-vacant|Application-form).*\.pdf/i,
      notes: "First few auction/sale PDFs from OSHB notices.",
    },
  },
  {
    sourceId: "consumer_commission_probe",
    label: "Consumer commission/e-Jagriti public probe",
    sourceClass: "wave2_consumer_cases_probe",
    pages: [
      {
        artifactId: "e-jagriti-home",
        url: "https://e-jagriti.gov.in/",
        notes: "Official e-Jagriti consumer commission portal landing page.",
      },
      {
        artifactId: "ncdrc-home",
        url: "https://ncdrc.nic.in/",
        notes: "NCDRC official landing page; points users to e-Jagriti for orders/judgments.",
      },
      {
        artifactId: "confonet-home-dns-probe",
        url: "https://confonet.nic.in/index.html",
        notes: "Legacy CONFONET landing page; may be DNS/availability blocked.",
      },
    ],
    seedDocs: [
      {
        artifactId: "ncdrc-rti-page-with-ejagriti-reference",
        url: "https://ncdrc.nic.in/bare_acts/RTIact.htm",
        notes: "Official NCDRC page referencing e-Jagriti for orders/judgments; sample public HTML artifact.",
      },
    ],
  },
  {
    sourceId: "wave3_brittle_access_probes",
    label: "Wave 3 brittle source access probes",
    sourceClass: "wave3_access_probe_only",
    pages: [
      {
        artifactId: "bhulekh-rorview",
        url: "https://bhulekh.ori.nic.in/RoRView.aspx",
        notes: "Bhulekh public RoR entry page; session workflow required for actual RoR.",
      },
      {
        artifactId: "rccms-login",
        url: "https://bhulekh.ori.nic.in/rccms/",
        notes: "RCCMS login/access probe; expected to be gated or unavailable without credentials.",
      },
      {
        artifactId: "rccms-case-status",
        url: "https://bhulekh.ori.nic.in/rccms/Cause_StatusCustomise.aspx",
        notes: "RCCMS public case-status page probe; useful to confirm query fields and captcha/session requirements.",
      },
      {
        artifactId: "rccms-user-manual",
        url: "https://bhulekh.ori.nic.in/rccms/REVENUECASE/RCCMS-User%20Manual.pdf",
        notes: "RCCMS user manual linked from the official login page; useful for understanding case lookup workflows.",
      },
      {
        artifactId: "ecourts-district-party-form",
        url: "https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index",
        notes: "District eCourts party-name form probe; external HTTP often returns 403, browser/captcha required.",
      },
      {
        artifactId: "high-court-party-form",
        url: "https://hcservices.ecourts.gov.in/ecourtindiaHC/cases/ki_petres.php?state_cd=11&dist_cd=1&court_code=1&stateNm=Odisha",
        notes: "High Court eCourts party-name form probe; external HTTP often returns 403, browser/captcha required.",
      },
      {
        artifactId: "cersai-home",
        url: "https://www.cersai.org.in/CERSAI/home.prg",
        notes: "CERSAI official home/public search access probe.",
      },
      {
        artifactId: "cersai-asset-search-current",
        url: "https://www.cersai.org.in/CERSAI/asstsrch.prg",
        notes: "Current asset-based public search page linked from CERSAI home.",
      },
      {
        artifactId: "cersai-borrower-search-current",
        url: "https://www.cersai.org.in/CERSAI/dbtrsrch.prg",
        notes: "Current borrower-based public search page linked from CERSAI home.",
      },
      {
        artifactId: "cersai-search-report-current",
        url: "https://www.cersai.org.in/CERSAI/searchreport.prg",
        notes: "Current CERSAI search report page linked from CERSAI home.",
      },
      {
        artifactId: "cersai-borrower-search-probe",
        url: "https://www.cersai.org.in/Search/SearchByBorrower.aspx",
        notes: "Previously documented borrower-search path; currently may return 404 or moved.",
      },
      {
        artifactId: "igr-odisha-home",
        url: "https://www.igrodisha.gov.in/",
        notes: "IGR Odisha landing page; EC/deed retrieval is manual/login/payment-gated.",
      },
      {
        artifactId: "igr-know-your-sro",
        url: "https://www.igrodisha.gov.in/SROffice/SearchDistRoOffice.aspx",
        notes: "IGR public SRO lookup page; useful for district/SRO mapping inputs.",
      },
      {
        artifactId: "igr-document-registration-procedure",
        url: "https://www.igrodisha.gov.in/pdf/Registration_Documents.pdf",
        notes: "Official IGR document registration procedure PDF.",
      },
      {
        artifactId: "igr-required-documents-registration",
        url: "https://www.igrodisha.gov.in/pdf/ListOfDocuments.pdf",
        notes: "Official IGR required documents for registration PDF.",
      },
      {
        artifactId: "igr-public-service-timeline",
        url: "https://www.igrodisha.gov.in/pdf/PublicServicesDeliveryTimeLine.pdf",
        notes: "Official IGR public service delivery timeline PDF.",
      },
    ],
  },
];

function parseArgs(argv) {
  const options = {
    root: "pid/data/raw",
    runDate: utcDateStamp(),
    source: "all",
    insecure: true,
    maxLinkedDocs: 3,
    skipExisting: true,
    throttleMs: 500,
  };

  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--root=")) options.root = arg.slice("--root=".length);
    else if (arg.startsWith("--date=")) options.runDate = arg.slice("--date=".length);
    else if (arg.startsWith("--source=")) options.source = arg.slice("--source=".length);
    else if (arg.startsWith("--max-linked-docs=")) options.maxLinkedDocs = Number(arg.slice("--max-linked-docs=".length));
    else if (arg.startsWith("--throttle-ms=")) options.throttleMs = Number(arg.slice("--throttle-ms=".length));
    else if (arg === "--strict-tls") options.insecure = false;
    else if (arg === "--no-skip-existing") options.skipExisting = false;
  }

  return options;
}

async function sleep(ms) {
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
}

function artifactTypeFor(url, contentType) {
  const type = String(contentType ?? "").toLowerCase();
  if (type.includes("text/html")) return "html";
  if (type.includes("application/pdf")) return "pdf";
  if (type.includes("image/jpeg")) return "jpg";
  if (type.includes("image/png")) return "png";
  if (type.includes("application/json")) return "json";
  return inferArtifactType(url, contentType);
}

function extractTitle(html) {
  const match = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtml(match[1]) : null;
}

function extractLinks(html, baseUrl) {
  return [...String(html).matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => {
      try {
        return {
          href: absolutizeUrl(baseUrl, match[1]),
          text: decodeHtml(match[2]),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function summarizeHtml({ html, baseUrl }) {
  const links = extractLinks(html, baseUrl);
  return {
    title: extractTitle(html),
    byte_length: Buffer.byteLength(html),
    link_count: links.length,
    pdf_links: links.filter((link) => /\.pdf($|\?)/i.test(link.href)).slice(0, 25),
    candidate_links: links
      .filter((link) => /(auction|sale|notice|judg|order|case|land|plot|planning|zoning|map|rera|sarfaesi|search|ror|case status)/i.test(`${link.text} ${link.href}`))
      .slice(0, 50),
    form_count: (html.match(/<form\b/gi) ?? []).length,
    input_count: (html.match(/<input\b/gi) ?? []).length,
    select_count: (html.match(/<select\b/gi) ?? []).length,
    has_captcha_hint: /captcha|securimage/i.test(html),
    has_login_hint: /login|password|user\s*id|userid/i.test(html),
  };
}

async function saveUrl({ archive, source, item, options, defaultArtifactId, query = {} }) {
  const artifactId = item.artifactId ?? defaultArtifactId ?? safeSlug(item.url);
  try {
    if (options.skipExisting && await archive.artifactExistsAny(source.sourceId, artifactId)) {
      return {
        source_id: source.sourceId,
        artifact_id: artifactId,
        url: item.url,
        skipped_existing: true,
      };
    }

    const response = await fetchBuffer(item.url, {
      insecure: options.insecure,
      failOnHttpError: false,
      timeoutMs: 45_000,
    });
    const artifactType = artifactTypeFor(item.url, response.contentType);
    const row = await archive.saveFetchedArtifact({
      sourceId: source.sourceId,
      artifactId,
      artifactType,
      sourceUrl: item.url,
      query: {
        ...query,
        source_class: source.sourceClass,
        label: item.label ?? source.label,
      },
      httpStatus: response.httpStatus,
      contentType: response.contentType,
      body: response.body,
      notes: item.notes,
      skipIfExists: options.skipExisting,
      parseStatus: response.httpStatus >= 200 && response.httpStatus < 400 ? "raw_saved" : "raw_saved_http_error",
    });

    let summary = {
      source_url: item.url,
      artifact_id: artifactId,
      artifact_type: artifactType,
      http_status: response.httpStatus,
      content_type: response.contentType,
      byte_length: response.body.length,
      notes: item.notes,
    };

    if (artifactType === "html") {
      summary = {
        ...summary,
        ...summarizeHtml({ html: response.body.toString("utf8"), baseUrl: item.url }),
      };
    }

    await archive.saveDerivedJson(source.sourceId, `${artifactId}_summary`, summary, { skipIfExists: options.skipExisting });
    return { ...summary, storage_path: row.storage_path };
  } catch (error) {
    const summary = {
      source_url: item.url,
      artifact_id: artifactId,
      error: error.message,
      notes: item.notes,
    };
    await archive.saveDerivedJson(source.sourceId, `${artifactId}_fetch_error`, summary, { skipIfExists: options.skipExisting });
    return summary;
  } finally {
    await sleep(options.throttleMs);
  }
}

async function collectSource(source, archive, options) {
  const results = [];
  const pageSummaries = new Map();

  for (const page of source.pages ?? []) {
    const result = await saveUrl({ archive, source, item: page, options });
    results.push({ type: "page", ...result });
    pageSummaries.set(page.artifactId, result);
  }

  for (const doc of source.seedDocs ?? []) {
    const result = await saveUrl({ archive, source, item: doc, options, query: { seed_doc: true } });
    results.push({ type: "seed_doc", ...result });
  }

  if (source.linkFollow) {
    const pageResult = pageSummaries.get(source.linkFollow.fromArtifactId);
    const links = [
      ...(pageResult?.pdf_links ?? []),
      ...(pageResult?.candidate_links ?? []),
    ];
    const unique = new Map();
    for (const link of links) {
      if (source.linkFollow.include.test(`${link.href} ${link.text}`) && !unique.has(link.href)) {
        unique.set(link.href, link);
      }
    }

    const linked = [...unique.values()].slice(0, Math.min(options.maxLinkedDocs, source.linkFollow.maxDocs ?? options.maxLinkedDocs));
    for (const link of linked) {
      const result = await saveUrl({
        archive,
        source,
        item: {
          artifactId: `linked-${safeSlug(link.text || link.href, "doc")}`,
          url: link.href,
          notes: `${source.linkFollow.notes} Link text: ${link.text}`,
        },
        options,
        query: { linked_from: source.linkFollow.fromArtifactId, link_text: link.text },
      });
      results.push({ type: "linked_doc", ...result });
    }
  }

  const sourceSummary = {
    source_id: source.sourceId,
    label: source.label,
    source_class: source.sourceClass,
    artifact_count: results.length,
    saved_or_skipped: results.filter((result) => !result.error).length,
    errors: results.filter((result) => result.error),
    http_errors: results.filter((result) => result.http_status && result.http_status >= 400),
    results,
  };
  await archive.saveDerivedJson(source.sourceId, "source_sample_summary", sourceSummary, { skipIfExists: false });
  return sourceSummary;
}

async function main() {
  const options = parseArgs(process.argv);
  const selected = options.source === "all"
    ? SOURCE_GROUPS
    : SOURCE_GROUPS.filter((source) => options.source.split(",").includes(source.sourceId));
  const archive = new RawArchive({
    root: options.root,
    runDate: options.runDate,
    collectorVersion: "pid-source-samples-v1",
  });

  const results = [];
  for (const source of selected) {
    results.push(await collectSource(source, archive, options));
  }

  await archive.saveDerivedJson("_runs", `source_samples_${options.runDate}_${Date.now()}`, {
    run_date: options.runDate,
    root: options.root,
    selected_sources: selected.map((source) => source.sourceId),
    results,
  });

  console.log(JSON.stringify({
    run_date: options.runDate,
    selected_sources: selected.map((source) => source.sourceId),
    source_count: results.length,
    artifact_count: results.reduce((sum, source) => sum + source.artifact_count, 0),
    http_error_count: results.reduce((sum, source) => sum + source.http_errors.length, 0),
    error_count: results.reduce((sum, source) => sum + source.errors.length, 0),
    results: results.map((source) => ({
      source_id: source.source_id,
      artifact_count: source.artifact_count,
      http_errors: source.http_errors.map((item) => ({ artifact_id: item.artifact_id, http_status: item.http_status, url: item.source_url })),
      errors: source.errors.map((item) => ({ artifact_id: item.artifact_id, error: item.error, url: item.source_url })),
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
