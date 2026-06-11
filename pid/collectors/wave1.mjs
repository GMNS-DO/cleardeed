#!/usr/bin/env node
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import {
  RawArchive,
  absolutizeUrl,
  decodeHtml,
  fetchBuffer,
  inferArtifactType,
  readJson,
  safeSlug,
  utcDateStamp,
} from "../lib/raw-archive.mjs";

const REVENUE_SOURCES = [
  {
    sourceId: "odisha_revenue_land_acquisition",
    url: "https://revenue.odisha.gov.in/en/communication/land-acquisition",
    label: "Odisha Revenue land acquisition",
  },
  {
    sourceId: "odisha_revenue_sia_4_1",
    url: "https://revenue.odisha.gov.in/en/Communication/sia-notification/4-1-notification",
    label: "Odisha Revenue SIA 4(1)",
  },
];

const ORERA_SOURCES = [
  "https://rera.odisha.gov.in/",
  "https://rera.odisha.gov.in/projects/project-list",
  "https://rera.odisha.gov.in/real-estate-agents",
];

const ORERA_API_KEY = "22CSMTOOL2022";
const ORERA_DMS_FILE_TOKEN_KEY = "oreradms123";
const ORERA_PMS_API_BASE = "https://reraapps.odisha.gov.in/pms/api/";
const ORERA_COMPLAINT_API_BASE = "https://reraapps.odisha.gov.in/complaint/api/";
const ORERA_DMS_DECRYPT_URL = "https://reraapps.odisha.gov.in/dms/fileDecryptHandlerForPdfPublic";
const ORERA_DMS_VIEWER_URL = "https://reraapps.odisha.gov.in/dms/public/library/common_viewer/demos-preview.html";
const ORERA_API_HEADERS = {
  "Content-Type": "application/json",
  Origin: "https://rera.odisha.gov.in",
  Referer: "https://rera.odisha.gov.in/",
};

const ORERA_PROJECT_LISTING_PAYLOAD = {
  searchTerm: "",
  district: 0,
  tahasil: 0,
  strtYear: 0,
  endYear: 0,
  projectStatus: [],
  carpetArea: "",
  propertyType: [],
  latitude: "",
  longitude: "",
  radius: 0,
  approvedStatus: false,
  revokedStatus: false,
  page: 1,
  pageSize: 10,
  sortOrder: "asc",
};

const ORERA_API_REQUESTS = [
  {
    artifactId: "api-project-counts",
    baseUrl: ORERA_PMS_API_BASE,
    endpoint: "master/Projects/totalProjectCountDetails",
    payload: "",
    label: "ORERA project count totals",
  },
  {
    artifactId: "api-registered-projects",
    baseUrl: ORERA_PMS_API_BASE,
    endpoint: "master/ProjectsOnlineListing/onlineProjectListing",
    payload: { filteredId: 1 },
    label: "ORERA registered/online project listing",
  },
  {
    artifactId: "api-approved-agents",
    baseUrl: ORERA_PMS_API_BASE,
    endpoint: "master/Agents/agentListing",
    payload: { status: 16 },
    label: "ORERA issued/active agent listing",
  },
  {
    artifactId: "api-online-complaints-page-1",
    baseUrl: ORERA_COMPLAINT_API_BASE,
    endpoint: "master/Complaints/complaintStatus",
    payload: {
      page: 1,
      perPage: 10,
      searchTerm: "",
      isAllDownload: 0,
      selectedFeeType: 0,
      selectedComplaintBefore: 0,
      status: [],
    },
    label: "ORERA online complaint status page 1",
  },
  {
    artifactId: "api-offline-complaints-page-1",
    baseUrl: ORERA_COMPLAINT_API_BASE,
    endpoint: "master/Complaints/complaintStatusOffline",
    payload: {
      page: 1,
      perPage: 10,
      searchTerm: "",
      selectedFeeType: 0,
      selectedComplaintBefore: 0,
      status: [],
    },
    label: "ORERA offline complaint status page 1",
  },
];

const ORERA_PROJECT_DETAIL_ENDPOINTS = [
  {
    artifactSuffix: "overview",
    endpoint: "project/ProjectOverview/projectDetails",
    label: "Project overview",
  },
  {
    artifactSuffix: "land-details",
    endpoint: "project/ProjectOverview/landDetails",
    label: "Land details",
  },
  {
    artifactSuffix: "facility-details",
    endpoint: "project/ProjectOverview/facilityDetails",
    label: "Facility details",
  },
  {
    artifactSuffix: "bank-accounts",
    endpoint: "project/ProjectOverview/getBankAccountDetails",
    label: "Bank account details",
  },
  {
    artifactSuffix: "professionals",
    endpoint: "project/ProjectBooking/professinalDetails",
    label: "Project professionals",
  },
];

const ORERA_DOCUMENT_ID_FIELDS = new Set([
  "certificateCopyId",
  "layoutPlanId",
  "buildingPlanId",
  "sitePlanId",
  "buildingDrawPlanId",
  "buildibgDrawPlanId",
  "nakhshaLocationId",
  "corrigendumFileCopyId",
  "documentId",
  "plotEcId",
  "plotRorId",
  "saleDeedId",
  "poaId",
  "shareAllocId",
  "fileId",
]);

const ORERA_DOCUMENT_FIELD_PRIORITY = {
  plotEcId: 1,
  plotRorId: 2,
  poaId: 3,
  saleDeedId: 4,
  shareAllocId: 5,
  fileId: 6,
  certificateCopyId: 10,
  layoutPlanId: 11,
  buildingPlanId: 12,
  sitePlanId: 13,
  buildingDrawPlanId: 14,
  buildibgDrawPlanId: 15,
  nakhshaLocationId: 16,
  documentId: 20,
  corrigendumFileCopyId: 30,
};

const DRT_SEED_URLS = [
  "https://cis.drt.gov.in/drtlive/order/Hgenerate_causelist_save1.php?filing_no=MTEvMjkvMDgvMjAyNS0xLWN1dHRhY2s%3D&id=1781901520",
  "https://cis.drt.gov.in/drtlive/order/Hgenerate_causelist_save1.php?filing_no=MTEvMDQvMDgvMjAyNS0xLWN1dHRhY2s%3D&id=1403341620",
];

const BHUNAKSHA_SAMPLES = [
  {
    sourceId: "bhunaksha_wfs",
    label: "Mendhasala live WFS sample",
    lat: 20.272688,
    lon: 85.701271,
    layer: "khurda_bhubaneswar",
    radius: 0.001,
  },
];

function parseArgs(argv) {
  const options = {
    root: "pid/data/raw",
    runDate: utcDateStamp(),
    source: "all",
    maxPdfsPerRevenuePage: 5,
    maxRevenuePages: 1,
    insecure: true,
    skipPdfs: false,
    saveOreraAssets: true,
    maxOreraProjectDetails: 5,
    maxOreraDocumentsPerProject: 8,
    maxOreraProjectPages: 1,
    oreraProjectPageSize: 10,
    throttleMs: 750,
    skipExisting: true,
  };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--root=")) options.root = arg.slice("--root=".length);
    else if (arg.startsWith("--date=")) options.runDate = arg.slice("--date=".length);
    else if (arg.startsWith("--source=")) options.source = arg.slice("--source=".length);
    else if (arg.startsWith("--max-pdfs=")) options.maxPdfsPerRevenuePage = Number(arg.slice("--max-pdfs=".length));
    else if (arg.startsWith("--max-revenue-pages=")) options.maxRevenuePages = Number(arg.slice("--max-revenue-pages=".length));
    else if (arg.startsWith("--max-orera-project-details=")) {
      options.maxOreraProjectDetails = Number(arg.slice("--max-orera-project-details=".length));
    }
    else if (arg.startsWith("--max-orera-documents-per-project=")) {
      options.maxOreraDocumentsPerProject = Number(arg.slice("--max-orera-documents-per-project=".length));
    }
    else if (arg.startsWith("--max-orera-project-pages=")) {
      options.maxOreraProjectPages = Number(arg.slice("--max-orera-project-pages=".length));
    }
    else if (arg.startsWith("--orera-project-page-size=")) {
      options.oreraProjectPageSize = Number(arg.slice("--orera-project-page-size=".length));
    }
    else if (arg.startsWith("--throttle-ms=")) options.throttleMs = Number(arg.slice("--throttle-ms=".length));
    else if (arg === "--no-skip-existing") options.skipExisting = false;
    else if (arg === "--skip-pdfs") options.skipPdfs = true;
    else if (arg === "--skip-orera-assets") options.saveOreraAssets = false;
    else if (arg === "--strict-tls") options.insecure = false;
  }
  return options;
}

async function throttle(options) {
  if (options.throttleMs > 0) await delay(options.throttleMs);
}

function extractRows(html, baseUrl) {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  return rows
    .map((row) => {
      const cells = row.match(/<td[\s\S]*?<\/td>/gi) ?? [];
      if (cells.length < 3) return null;
      const texts = cells.map(decodeHtml);
      const linkMatch = row.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/i);
      return {
        counter: texts[0] ?? "",
        title: texts[1] ?? "",
        date: texts[2] ?? "",
        letter_number: texts[3] ?? "",
        download_url: linkMatch ? absolutizeUrl(baseUrl, linkMatch[1]) : null,
        raw_text: texts.filter(Boolean).join(" | "),
      };
    })
    .filter((row) => row && row.title && row.title.toLowerCase() !== "title");
}

function extractLinks(html, baseUrl) {
  const links = [];
  for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1];
    if (!href || href.startsWith("javascript:") || href.startsWith("#")) continue;
    links.push({
      href: absolutizeUrl(baseUrl, href),
      text: decodeHtml(match[2]),
    });
  }
  return links;
}

function extractAssetUrls(html, baseUrl) {
  const origin = new URL(baseUrl).origin;
  const baseHref = html.match(/<base[^>]+href=["']([^"']+)["']/i)?.[1];
  const assetBaseUrl = baseHref ? new URL(baseHref, `${origin}/`).toString() : baseUrl;
  const urls = [];
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi)) {
    urls.push(absolutizeUrl(assetBaseUrl, match[1]));
  }
  return [...new Set(urls)];
}

function extractPagerPages(html) {
  const pages = new Set([0]);
  for (const match of html.matchAll(/[?&]page=(\d+)/gi)) {
    pages.add(Number(match[1]));
  }
  return [...pages].filter(Number.isFinite).sort((a, b) => a - b);
}

function discoverOreraEndpoints(jsText) {
  const patterns = [
    /https?:\/\/[^"'` )]+/g,
    /\/[A-Za-z0-9_./-]*(?:api|project|promoter|agent|complaint|registration|document)[A-Za-z0-9_./-]*/gi,
  ];
  const hits = new Set();
  for (const pattern of patterns) {
    for (const match of jsText.matchAll(pattern)) {
      const value = match[0]
        .replace(/\\u002F/g, "/")
        .replace(/\\\//g, "/")
        .trim();
      if (/rera|pms|cms|complaint|project|promoter|agent|registration|document/i.test(value)) {
        hits.add(value);
      }
    }
  }
  return [...hits].sort();
}

function makeOreraRequestBody(payload) {
  const requestData = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  const requestToken = createHmac("sha256", ORERA_API_KEY).update(requestData).digest("hex");
  return JSON.stringify({
    REQUEST_DATA: requestData,
    REQUEST_TOKEN: requestToken,
  });
}

function makeOreraDmsToken(fileId) {
  return createHmac("sha256", ORERA_DMS_FILE_TOKEN_KEY).update(String(fileId)).digest("hex");
}

function parsePossiblyNestedJson(text) {
  let parsed = JSON.parse(text);
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  return parsed;
}

function decodeOreraResponse(body) {
  const envelope = JSON.parse(body.toString("utf8"));
  const responseData = envelope.RESPONSE_DATA ?? envelope.responseData ?? envelope.data;
  const responseToken = envelope.RESPONSE_TOKEN ?? envelope.responseToken ?? envelope.token;
  if (!responseData) {
    return { envelope, decoded: envelope, token_verified: false, notes: "No RESPONSE_DATA envelope found." };
  }
  const expectedToken = createHmac("sha256", ORERA_API_KEY).update(responseData).digest("hex");
  const decodedText = Buffer.from(responseData, "base64").toString("utf8");
  return {
    envelope,
    decoded: parsePossiblyNestedJson(decodedText),
    token_verified: responseToken ? responseToken === expectedToken : false,
  };
}

function summarizeOreraDecoded(decoded) {
  const result = decoded?.result ?? decoded?.data ?? decoded?.list ?? decoded;
  if (Array.isArray(result)) {
    return {
      status: decoded?.status ?? decoded?.success ?? null,
      message: decoded?.message ?? null,
      result_type: "array",
      record_count: result.length,
      sample_records: result.slice(0, 25),
    };
  }
  if (result && typeof result === "object") {
    return {
      status: decoded?.status ?? decoded?.success ?? null,
      message: decoded?.message ?? null,
      result_type: "object",
      keys: Object.keys(result).sort(),
      values: result,
    };
  }
  return {
    status: decoded?.status ?? null,
    result_type: typeof result,
    value: result,
  };
}

async function saveOreraApiResponse(archive, options, request) {
  const url = new URL(request.endpoint, request.baseUrl).toString();
  if (options.skipExisting && await archive.artifactExists("orera", request.artifactId, "json")) {
    let decoded;
    let apiSummary = { result_type: "skipped_existing" };
    if (await archive.derivedExists("orera", `${request.artifactId}_decoded`)) {
      const decodedArtifact = await readJson(archive.extractedPath("orera", `${request.artifactId}_decoded`));
      decoded = decodedArtifact.decoded;
    }
    if (await archive.derivedExists("orera", `${request.artifactId}_summary`)) {
      apiSummary = await readJson(archive.extractedPath("orera", `${request.artifactId}_summary`));
    }
    return {
      summary: {
        source_id: "orera",
        api: request.artifactId,
        http_status: apiSummary.http_status ?? null,
        token_verified: apiSummary.token_verified ?? null,
        record_count: apiSummary.record_count ?? null,
        result_type: apiSummary.result_type ?? "skipped_existing",
        skipped_existing: true,
      },
      decoded,
    };
  }

  const requestBody = makeOreraRequestBody(request.payload);
  let fetched;
  try {
    fetched = await fetchBuffer(url, {
      insecure: options.insecure,
      method: "POST",
      headers: ORERA_API_HEADERS,
      body: requestBody,
      timeoutMs: 60_000,
      failOnHttpError: false,
    });
  } catch (error) {
    await archive.saveDerivedJson("orera", `${request.artifactId}_summary`, {
      source_url: url,
      label: request.label,
      http_status: null,
      token_verified: false,
      result_type: "fetch_error",
      error: error.message,
    });
    return {
      summary: {
        source_id: "orera",
        api: request.artifactId,
        http_status: null,
        token_verified: false,
        record_count: null,
        result_type: "fetch_error",
        error: error.message,
      },
      decoded: undefined,
    };
  }
  await archive.saveFetchedArtifact({
    sourceId: "orera",
    artifactId: request.artifactId,
    artifactType: "json",
    sourceUrl: url,
    body: fetched.body,
    httpStatus: fetched.httpStatus,
    contentType: fetched.contentType,
    query: {
      label: request.label,
      endpoint: request.endpoint,
      payload: request.payload,
      request_envelope: "REQUEST_DATA base64 + REQUEST_TOKEN HMAC-SHA256",
    },
    skipIfExists: options.skipExisting,
  });

  let decoded;
  let apiSummary;
  try {
    decoded = decodeOreraResponse(fetched.body);
    apiSummary = summarizeOreraDecoded(decoded.decoded);
    await archive.saveDerivedJson("orera", `${request.artifactId}_decoded`, {
      source_url: url,
      label: request.label,
      token_verified: decoded.token_verified,
      decoded: decoded.decoded,
    });
  } catch (error) {
    decoded = { token_verified: false };
    apiSummary = {
      result_type: "decode_error",
      error: error.message,
      body_sample: fetched.body.toString("utf8").slice(0, 1000),
    };
  }
  await archive.saveDerivedJson("orera", `${request.artifactId}_summary`, {
    source_url: url,
    label: request.label,
    http_status: fetched.httpStatus,
    token_verified: decoded.token_verified,
    ...apiSummary,
  });
  return {
    summary: {
      source_id: "orera",
      api: request.artifactId,
      http_status: fetched.httpStatus,
      token_verified: decoded.token_verified,
      record_count: apiSummary.record_count ?? null,
      result_type: apiSummary.result_type,
    },
    decoded: decoded.decoded,
  };
}

async function collectOreraApis(archive, options) {
  const summaries = [];
  const decodedByArtifact = {};
  for (const request of ORERA_API_REQUESTS) {
    const result = await saveOreraApiResponse(archive, options, request);
    summaries.push(result.summary);
    decodedByArtifact[request.artifactId] = result.decoded;
    await throttle(options);
  }
  return { summaries, decodedByArtifact };
}

async function collectOreraProjectListingPages(archive, options) {
  const summaries = [];
  const rows = [];
  const pageCount = Math.max(1, options.maxOreraProjectPages);
  const pageSize = Math.max(1, options.oreraProjectPageSize);

  for (let page = 1; page <= pageCount; page += 1) {
    const payload = { ...ORERA_PROJECT_LISTING_PAYLOAD, page, pageSize };
    const request = {
      artifactId: `api-project-listing-page-${page}`,
      baseUrl: ORERA_PMS_API_BASE,
      endpoint: "master/Projects/projectListing",
      payload,
      label: `ORERA public project listing page ${page} with detail IDs`,
    };
    const result = await saveOreraApiResponse(archive, options, request);
    summaries.push({ ...result.summary, page, page_size: pageSize });
    rows.push(...extractOreraProjectRows(result.decoded));
    await throttle(options);
  }

  await archive.saveDerivedJson("orera", "project_listing_pages_summary", {
    source_url: new URL("master/Projects/projectListing", ORERA_PMS_API_BASE).toString(),
    requested_pages: pageCount,
    page_size: pageSize,
    row_count: rows.length,
    sample_rows: rows.slice(0, 25),
  });

  return { summaries, rows };
}

function extractOreraProjectRows(decodedProjectListing) {
  const result = decodedProjectListing?.result ?? decodedProjectListing?.data ?? [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  return [];
}

function projectDetailIdentity(row) {
  const projectId = row?.intid ?? row?.projectId ?? row?.project_id ?? row?.id;
  const promoterId = row?.promoterId ?? row?.promotorId ?? row?.promoter_id;
  if (!projectId || !promoterId) return null;
  return {
    projectId: String(projectId),
    promoterId: String(promoterId),
    projectName: row.project_Name ?? row.projectName ?? row.vchProjectName ?? null,
    promoterName: row.promotor_Name ?? row.promoterName ?? row.vchPromoterName ?? null,
    registrationNo: row.reg_no ?? row.regNo ?? row.refrenceNumber ?? null,
    district: row.districtName ?? row.district ?? null,
  };
}

function extractOreraDocumentReferences(value, path = [], refs = []) {
  if (!value || typeof value !== "object") return refs;
  if (Array.isArray(value)) {
    value.forEach((item, index) => extractOreraDocumentReferences(item, [...path, String(index)], refs));
    return refs;
  }

  for (const [key, raw] of Object.entries(value)) {
    if (raw && ORERA_DOCUMENT_ID_FIELDS.has(key) && Number(raw) > 0) {
      refs.push({
        fileId: String(raw),
        field: key,
        path: [...path, key].join("."),
        fileName: value[key.replace(/Id$/, "")] ?? value.documentName ?? value.name ?? null,
      });
    }
    if (raw && typeof raw === "object") {
      extractOreraDocumentReferences(raw, [...path, key], refs);
    }
  }
  return refs;
}

async function saveOreraDmsDocument(archive, options, project, ref) {
  const token = makeOreraDmsToken(ref.fileId);
  const viewerUrl = `${ORERA_DMS_VIEWER_URL}?fileId=${encodeURIComponent(ref.fileId)}&text=${token}`;
  const form = new URLSearchParams({ fileId: ref.fileId, logId: "", token });
  const artifactIdBase = `project-${project.projectId}-doc-${ref.fileId}-${safeSlug(ref.field, "file")}`;
  if (options.skipExisting && await archive.artifactExistsAny("orera", artifactIdBase)) {
    return {
      file_id: ref.fileId,
      field: ref.field,
      file_name: ref.fileName,
      skipped_existing: true,
      file_saved: true,
    };
  }

  let decrypt;
  try {
    decrypt = await fetchBuffer(ORERA_DMS_DECRYPT_URL, {
      insecure: options.insecure,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Referer: viewerUrl,
        Authorization: `bearer ${token}`,
      },
      body: form.toString(),
      timeoutMs: 30_000,
      failOnHttpError: false,
    });
  } catch (error) {
    return {
      file_id: ref.fileId,
      field: ref.field,
      file_name: ref.fileName,
      file_saved: false,
      result_type: "decrypt_fetch_error",
      error: error.message,
    };
  }

  await archive.saveFetchedArtifact({
    sourceId: "orera",
    artifactId: `${artifactIdBase}-decrypt`,
    artifactType: "json",
    sourceUrl: ORERA_DMS_DECRYPT_URL,
    body: decrypt.body,
    httpStatus: decrypt.httpStatus,
    contentType: decrypt.contentType,
    query: { project, file_reference: ref, viewer_url: viewerUrl },
    skipIfExists: options.skipExisting,
  });

  let parsed;
  try {
    parsed = JSON.parse(decrypt.body.toString("utf8"));
  } catch (error) {
    return { file_id: ref.fileId, field: ref.field, decrypt_status: decrypt.httpStatus, error: error.message };
  }

  const filePath = parsed?.result?.filePath;
  if (!filePath) {
    return { file_id: ref.fileId, field: ref.field, decrypt_status: decrypt.httpStatus, dms_status: parsed?.status ?? null, file_saved: false };
  }

  let file;
  try {
    file = await fetchBuffer(filePath, {
      insecure: options.insecure,
      timeoutMs: 90_000,
      failOnHttpError: false,
    });
  } catch (error) {
    return {
      file_id: ref.fileId,
      field: ref.field,
      file_name: ref.fileName,
      decrypt_status: decrypt.httpStatus,
      file_saved: false,
      result_type: "document_fetch_error",
      error: error.message,
    };
  }
  const artifactType = inferArtifactType(filePath, file.contentType);
  await archive.saveFetchedArtifact({
    sourceId: "orera",
    artifactId: artifactIdBase,
    artifactType,
    sourceUrl: filePath,
    body: file.body,
    httpStatus: file.httpStatus,
    contentType: file.contentType,
    query: { project, file_reference: ref, viewer_url: viewerUrl, decrypt_response: parsed },
    skipIfExists: options.skipExisting,
  });

  return {
    file_id: ref.fileId,
    field: ref.field,
    file_name: ref.fileName,
    artifact_type: artifactType,
    http_status: file.httpStatus,
    content_type: file.contentType,
    bytes: file.body.length,
    file_saved: true,
  };
}

async function collectOreraProjectDetails(archive, options, decodedProjectListing) {
  const projectRows = extractOreraProjectRows(decodedProjectListing)
    .map(projectDetailIdentity)
    .filter(Boolean)
    .slice(0, Math.max(0, options.maxOreraProjectDetails));
  const summaries = [];
  const projectSummaries = [];

  for (const project of projectRows) {
    const payload = { projectId: project.projectId, promoterId: project.promoterId };
    const endpointResults = [];
    const documentRefs = [];
    for (const endpoint of ORERA_PROJECT_DETAIL_ENDPOINTS) {
      const request = {
        artifactId: `project-${project.projectId}-${endpoint.artifactSuffix}`,
        baseUrl: ORERA_PMS_API_BASE,
        endpoint: endpoint.endpoint,
        payload,
        label: `${endpoint.label}: ${project.projectName ?? project.projectId}`,
      };
      const result = await saveOreraApiResponse(archive, options, request);
      summaries.push({
        ...result.summary,
        project_id: project.projectId,
        promoter_id: project.promoterId,
        detail_type: endpoint.artifactSuffix,
      });
      endpointResults.push({
        detail_type: endpoint.artifactSuffix,
        endpoint: endpoint.endpoint,
        http_status: result.summary.http_status,
        token_verified: result.summary.token_verified,
        result_type: result.summary.result_type,
        record_count: result.summary.record_count,
      });
      for (const ref of extractOreraDocumentReferences(result.decoded, [endpoint.artifactSuffix])) {
        documentRefs.push(ref);
      }
      await throttle(options);
    }

    const seenFileIds = new Set();
    const selectedDocumentRefs = documentRefs
      .filter((ref) => {
        if (seenFileIds.has(ref.fileId)) return false;
        seenFileIds.add(ref.fileId);
        return true;
      })
      .sort((left, right) => {
        const leftPriority = ORERA_DOCUMENT_FIELD_PRIORITY[left.field] ?? 99;
        const rightPriority = ORERA_DOCUMENT_FIELD_PRIORITY[right.field] ?? 99;
        return leftPriority - rightPriority || left.path.localeCompare(right.path);
      })
      .slice(0, Math.max(0, options.maxOreraDocumentsPerProject));
    const documentResults = [];
    for (const ref of selectedDocumentRefs) {
      documentResults.push(await saveOreraDmsDocument(archive, options, project, ref));
      await throttle(options);
    }

    projectSummaries.push({ ...project, endpoints: endpointResults, documents: documentResults });
    await throttle(options);
  }

  await archive.saveDerivedJson("orera", "project_detail_sample_summary", {
    source: "ORERA public project detail APIs",
    requested_project_count: options.maxOreraProjectDetails,
    collected_project_count: projectSummaries.length,
    detail_endpoints: ORERA_PROJECT_DETAIL_ENDPOINTS,
    projects: projectSummaries,
  });

  return [
    {
      source_id: "orera",
      api: "project-detail-sample",
      projects_collected: projectSummaries.length,
      endpoint_calls: summaries.length,
      documents_saved: projectSummaries.reduce(
        (count, project) => count + project.documents.filter((document) => document.file_saved && !document.skipped_existing).length,
        0,
      ),
      documents_skipped_existing: projectSummaries.reduce(
        (count, project) => count + project.documents.filter((document) => document.skipped_existing).length,
        0,
      ),
    },
    ...summaries,
  ];
}

function parseDrtCases(html) {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const cases = [];
  for (const row of rows) {
    const cells = row.match(/<td[\s\S]*?<\/td>/gi) ?? [];
    if (cells.length < 3) continue;
    const texts = cells.map(decodeHtml).filter(Boolean);
    const joined = texts.join(" | ");
    const caseMatch = joined.match(/\b(?:OA|SA|MA|TA|APPEAL|IA)\/\d+\/\d{4}\b/i);
    if (!caseMatch) continue;
    const vsCell = texts.find((text) => /\bVs\b/i.test(text)) ?? "";
    const [applicantRaw, respondentRaw] = vsCell.split(/\bVs\b/i);
    cases.push({
      case_number: caseMatch[0],
      applicant: applicantRaw?.trim() || null,
      respondent: respondentRaw?.trim() || null,
      raw_text: joined,
    });
  }
  return cases;
}

function buildBhunakshaUrl({ lat, lon, layer, radius }) {
  const bbox = [
    (lon - radius).toFixed(4),
    (lat - radius).toFixed(4),
    (lon + radius).toFixed(4),
    (lat + radius).toFixed(4),
  ].join(",");
  return {
    bbox,
    url: `https://mapserver.odisha4kgeo.in/geoserver/revenue/wfs?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=revenue:${layer}&BBOX=${bbox},EPSG:4326&MAXFEATURES=500&OUTPUTFORMAT=application/json`,
  };
}

async function collectRevenue(archive, options) {
  const summary = [];
  for (const source of REVENUE_SOURCES) {
    const first = await fetchBuffer(source.url, { insecure: options.insecure });
    const firstHtml = first.body.toString("utf8");
    const availablePages = extractPagerPages(firstHtml);
    const pagesToFetch = availablePages.slice(0, Math.max(1, options.maxRevenuePages));
    const allRows = [];
    let pdfsSaved = 0;

    for (const page of pagesToFetch) {
      const pageUrl = page === 0 ? source.url : `${source.url}?page=${page}`;
      const fetched = page === 0 ? first : await fetchBuffer(pageUrl, { insecure: options.insecure });
      const html = fetched.body.toString("utf8");
      const artifactId = page === 0 ? "listing_page_0" : `listing_page_${page}`;
      await archive.saveFetchedArtifact({
        sourceId: source.sourceId,
        artifactId,
        artifactType: "html",
        sourceUrl: pageUrl,
        body: fetched.body,
        httpStatus: fetched.httpStatus,
        contentType: fetched.contentType,
        query: { label: source.label, page },
      });

      const rows = extractRows(html, pageUrl).map((row) => ({ ...row, page }));
      allRows.push(...rows);

      if (!options.skipPdfs) {
        for (const row of rows.filter((r) => r.download_url).slice(0, options.maxPdfsPerRevenuePage)) {
          const pdfUrl = row.download_url;
          const pdf = await fetchBuffer(pdfUrl, { insecure: options.insecure });
          const pdfId = safeSlug(`p${page}-${row.date}-${row.letter_number}-${row.title}`, "notice");
          await archive.saveFetchedArtifact({
            sourceId: source.sourceId,
            artifactId: pdfId,
            artifactType: inferArtifactType(pdfUrl, pdf.contentType),
            sourceUrl: pdfUrl,
            body: pdf.body,
            httpStatus: pdf.httpStatus,
            contentType: pdf.contentType,
            query: { parent_listing_url: pageUrl, page, title: row.title, date: row.date, letter_number: row.letter_number },
          });
          pdfsSaved += 1;
        }
      }
    }

    await archive.saveDerivedJson(source.sourceId, "listing_rows", {
      source_url: source.url,
      available_pages: availablePages,
      fetched_pages: pagesToFetch,
      row_count: allRows.length,
      rows: allRows,
    });

    summary.push({ source_id: source.sourceId, pages_fetched: pagesToFetch.length, listing_rows: allRows.length, pdfs_saved: pdfsSaved });
  }
  return summary;
}

async function collectOrera(archive, options) {
  const summary = [];
  const assetUrls = new Set();
  for (const url of ORERA_SOURCES) {
    const artifactId = safeSlug(new URL(url).pathname || "home", "home");
    let html;
    let skippedExisting = false;
    if (options.skipExisting && await archive.artifactExists("orera", artifactId, "html")) {
      html = await readFile(archive.artifactPath("orera", artifactId, "html"), "utf8");
      skippedExisting = true;
    } else {
      const { body, httpStatus, contentType } = await fetchBuffer(url, { insecure: options.insecure });
      html = body.toString("utf8");
      await archive.saveFetchedArtifact({
        sourceId: "orera",
        artifactId,
        artifactType: "html",
        sourceUrl: url,
        body,
        httpStatus,
        contentType,
        query: { page: artifactId },
        skipIfExists: options.skipExisting,
      });
    }
    for (const assetUrl of extractAssetUrls(html, url).filter((assetUrl) => new URL(assetUrl).hostname === "rera.odisha.gov.in")) {
      assetUrls.add(assetUrl);
    }
    const links = extractLinks(html, url).filter((link) =>
      /project|agent|complaint|registration|promoter|order/i.test(`${link.href} ${link.text}`)
    );
    await archive.saveDerivedJson("orera", `${artifactId}_links`, { source_url: url, link_count: links.length, links }, { skipIfExists: options.skipExisting });
    summary.push({ source_id: "orera", url, links: links.length, skipped_existing: skippedExisting || undefined });
  }

  if (options.saveOreraAssets) {
    const endpointHits = new Set();
    const savedAssets = [];
    for (const assetUrl of assetUrls) {
      const artifactId = safeSlug(new URL(assetUrl).pathname, "asset");
      if (options.skipExisting && await archive.artifactExistsAny("orera", artifactId)) {
        savedAssets.push(assetUrl);
        continue;
      }
      const fetched = await fetchBuffer(assetUrl, { insecure: options.insecure });
      const artifactType = inferArtifactType(assetUrl, fetched.contentType);
      await archive.saveFetchedArtifact({
        sourceId: "orera",
        artifactId,
        artifactType,
        sourceUrl: assetUrl,
        body: fetched.body,
        httpStatus: fetched.httpStatus,
        contentType: fetched.contentType,
        query: { asset: true },
        skipIfExists: options.skipExisting,
      });
      savedAssets.push(assetUrl);
      if (artifactType === "js") {
        for (const hit of discoverOreraEndpoints(fetched.body.toString("utf8"))) endpointHits.add(hit);
      }
    }
    await archive.saveDerivedJson("orera", "endpoint_discovery", {
      asset_count: savedAssets.length,
      assets: savedAssets,
      endpoint_count: endpointHits.size,
      endpoints: [...endpointHits].sort(),
    });
    summary.push({ source_id: "orera", assets_saved: savedAssets.length, endpoints_discovered: endpointHits.size });
  }
  const apiResults = await collectOreraApis(archive, options);
  summary.push(...apiResults.summaries);
  const projectListing = await collectOreraProjectListingPages(archive, options);
  summary.push(...projectListing.summaries);
  summary.push(...await collectOreraProjectDetails(archive, options, { result: projectListing.rows }));
  return summary;
}

async function collectDrt(archive, options) {
  const summary = [];
  const formUrl = "https://cis.drt.gov.in/drtlive/order/Hcreate_causelist1.php";
  const form = await fetchBuffer(formUrl, { insecure: options.insecure });
  await archive.saveFetchedArtifact({
    sourceId: "drt_cuttack_cause_lists",
    artifactId: "cause-list-form",
    artifactType: "html",
    sourceUrl: formUrl,
    body: form.body,
    httpStatus: form.httpStatus,
    contentType: form.contentType,
    query: { form: "Hcreate_causelist1" },
  });
  const formHtml = form.body.toString("utf8");
  const drtOptions = [...formHtml.matchAll(/<option\s+value=([^>\s]+)>([\s\S]*?)<\/option>/gi)].map((match) => ({
    value: decodeHtml(match[1]),
    label: decodeHtml(match[2]),
  }));
  await archive.saveDerivedJson("drt_cuttack_cause_lists", "cause_list_form_summary", {
    source_url: formUrl,
    drt_options: drtOptions,
    cuttack_option: drtOptions.find((option) => /cuttack/i.test(option.value + " " + option.label)) ?? null,
  });
  summary.push({ source_id: "drt_cuttack_cause_lists", form_saved: true, drt_options: drtOptions.length });

  for (const url of DRT_SEED_URLS) {
    const { body, httpStatus, contentType } = await fetchBuffer(url, { insecure: options.insecure });
    const html = body.toString("utf8");
    const artifactId = safeSlug(`cause-list-${new URL(url).searchParams.get("id")}`, "cause-list");
    await archive.saveFetchedArtifact({
      sourceId: "drt_cuttack_cause_lists",
      artifactId,
      artifactType: "html",
      sourceUrl: url,
      body,
      httpStatus,
      contentType,
      query: { seed_url: true },
    });
    const cases = parseDrtCases(html);
    await archive.saveDerivedJson("drt_cuttack_cause_lists", `${artifactId}_cases`, {
      source_url: url,
      case_count: cases.length,
      cases,
    });
    summary.push({ source_id: "drt_cuttack_cause_lists", url, cases: cases.length });
  }
  return summary;
}

async function collectBhunaksha(archive, options) {
  const summary = [];
  for (const sample of BHUNAKSHA_SAMPLES) {
    const { bbox, url } = buildBhunakshaUrl(sample);
    const { body, httpStatus, contentType } = await fetchBuffer(url, { insecure: options.insecure });
    const artifactId = safeSlug(`${sample.layer}-${sample.lat}-${sample.lon}`, "wfs-sample");
    await archive.saveFetchedArtifact({
      sourceId: sample.sourceId,
      artifactId,
      artifactType: "json",
      sourceUrl: url,
      body,
      httpStatus,
      contentType,
      query: { label: sample.label, lat: sample.lat, lon: sample.lon, layer: sample.layer, radius: sample.radius, bbox },
    });
    let parsed;
    try {
      parsed = JSON.parse(body.toString("utf8"));
    } catch {
      parsed = null;
    }
    const features = parsed?.features ?? [];
    await archive.saveDerivedJson(sample.sourceId, `${artifactId}_summary`, {
      source_url: url,
      query: { lat: sample.lat, lon: sample.lon, layer: sample.layer, radius: sample.radius, bbox },
      feature_count: Array.isArray(features) ? features.length : 0,
      sample_features: Array.isArray(features)
        ? features.slice(0, 10).map((feature) => ({
            id: feature.id,
            geometry_type: feature.geometry?.type,
            properties: feature.properties,
          }))
        : [],
    });
    summary.push({ source_id: sample.sourceId, layer: sample.layer, feature_count: Array.isArray(features) ? features.length : 0 });
  }
  return summary;
}

async function main() {
  const options = parseArgs(process.argv);
  const archive = new RawArchive({
    root: options.root,
    runDate: options.runDate,
    collectorVersion: "wave1-raw-collector-v1",
  });

  const selected = options.source === "all" ? ["revenue", "orera", "drt", "bhunaksha"] : options.source.split(",");
  const results = [];

  if (selected.includes("revenue")) results.push(...await collectRevenue(archive, options));
  if (selected.includes("orera")) results.push(...await collectOrera(archive, options));
  if (selected.includes("drt")) results.push(...await collectDrt(archive, options));
  if (selected.includes("bhunaksha")) results.push(...await collectBhunaksha(archive, options));

  const runSummary = {
    run_date: options.runDate,
    root: options.root,
    selected_sources: selected,
    results,
  };
  await archive.saveDerivedJson("_runs", `wave1_${options.runDate}_${Date.now()}`, runSummary);
  console.log(JSON.stringify(runSummary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
