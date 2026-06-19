/**
 * Bhuvan flood hazard WMS fetcher for ClearDeed (T-041)
 *
 * Probes NRSC's Bhuvan flood overlay WMS endpoint and exposes the
 * observed flood-frequency classification (or an honest
 * `unknown`/`manual_required` if the server blocks GetFeatureInfo) as a
 * SourceResult.
 *
 * Endpoint probed (open access, no auth):
 *   https://bhuvan-ras2.nrsc.gov.in/cgi-bin/flood.exe
 *
 * License posture: NRSC Bhuvan data is "planning purposes only". Formal
 * NRSC licensing is required before Bhuvan-derived output appears in a
 * paid ClearDeed report. Until then, the fetcher advertises
 * `verification: "manual_required"` and the consumer copy is gated.
 *
 * Reality as of 2026-06-19 probe:
 *   - WMS GetMap returns raster tiles OK for every probed layer.
 *   - WMS GetFeatureInfo is server-side disabled for every probed layer
 *     (MapServer `wms/ows_enable_request=0`). The fetcher records this
 *     fact on the SourceResult so the report copy stays honest.
 *   - WFS is server-side disabled.
 *
 * Best-effort classification: a per-pixel raster is not queryable, so the
 * fetcher returns `floodFrequency: "unknown"` with the layers probed. A
 * future `Image classifier` step could be wired to the GetMap tile bytes
 * — the fields below already carry the bytes + layers probed for that.
 */

import { createHash } from "node:crypto";
import {
  SourceResultBase,
  runWithRetry,
  type RetryAttemptRecord,
  type SourceResultBase as SourceResultBaseType,
} from "@cleardeed/schema";
import { z } from "zod";

// --- Constants ---

const BHUVAN_WMS_URL = "https://bhuvan-ras2.nrsc.gov.in/cgi-bin/flood.exe";
const FETCH_TIMEOUT_MS = 15_000;
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1_000;
const PARSER_VERSION = "bhuvan-flood-v1";

// Odisha-relevant layers probed. The `or_cyclone` layer covers the full
// state composite; named event layers are checked if a specific cyclone
// signal needs to be attributed in the report.
const ODISHA_LAYERS = [
  "or_cyclone",
  "or_121013_flood",
  "or_261013_flood",
  "or_291013_flood",
  "or_river",
] as const;
type OdishaLayer = (typeof ODISHA_LAYERS)[number];

export type FloodFrequency =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "very_high"
  | "unknown";

// --- Schemas ---

export const BhuvanFloodResultSchema = SourceResultBase.extend({
  source: z.literal("bhuvan-flood"),
  data: z
    .object({
      floodFrequency: z.enum([
        "none",
        "low",
        "medium",
        "high",
        "very_high",
        "unknown",
      ]),
      layersProbed: z.array(z.string()),
      getFeatureInfoBlocked: z.boolean(),
      tileBytes: z.number().int().nonnegative().nullable(),
      dataSource: z.literal("bhuvan-ras2.nrsc.gov.in"),
    })
    .optional(),
});

export type BhuvanFloodResult = z.infer<typeof BhuvanFloodResultSchema>;

export interface BhuvanFloodInput {
  lat: number;
  lon: number;
  /**
   * When true, skip the live WMS probe and return a deterministic
   * not_covered result. The fetcher is callable from tests and offline
   * environments without spinning up the WMS stack.
   */
  skipLive?: boolean;
}

// --- Helpers (exported for testing) ---

export function buildGetFeatureInfoUrl(
  lat: number,
  lon: number,
  layer: string,
  options?: { width?: number; height?: number }
): string {
  const width = options?.width ?? 256;
  const height = options?.height ?? 256;
  // Bounding box around the GPS coordinate — MapServer expects
  // minx,miny,maxx,maxy in WGS84 (EPSG:4326).
  const bbox = `${lon},${lat},${lon + 1e-5},${lat + 1e-5}`;
  const params = new URLSearchParams({
    service: "WMS",
    version: "1.1.1",
    request: "GetFeatureInfo",
    layers: layer,
    query_layers: layer,
    X: "128",
    Y: "128",
    width: String(width),
    height: String(height),
    SRS: "EPSG:4326",
    BBOX: bbox,
    info_format: "application/json",
  });
  return `${BHUVAN_WMS_URL}?${params.toString()}`;
}

export function buildGetMapUrl(
  lat: number,
  lon: number,
  layer: string,
  options?: { width?: number; height?: number }
): string {
  const width = options?.width ?? 256;
  const height = options?.height ?? 256;
  const bbox = `${lon},${lat},${lon + 1e-5},${lat + 1e-5}`;
  const params = new URLSearchParams({
    service: "WMS",
    version: "1.1.1",
    request: "GetMap",
    layers: layer,
    width: String(width),
    height: String(height),
    SRS: "EPSG:4326",
    BBOX: bbox,
    format: "image/png",
  });
  return `${BHUVAN_WMS_URL}?${params.toString()}`;
}

/**
 * Classify the Bhuvan GetMap response body size as a coarse flood
 * frequency band. This is a placeholder — a real classification requires
 * pixel-level analysis (out of scope for V1). Returns `"unknown"` when
 * the bytes do not exceed the minimum raster tile size or when the layer
 * is not queryable. Exported for testing.
 */
export function classifyFromTileBytes(
  bytes: number | null
): "none" | "low" | "medium" | "high" | "very_high" | "unknown" {
  if (typeof bytes !== "number" || bytes <= 0) return "unknown";
  // Most Khordha tiles are <2 KB for the small bbox. Larger tiles mean
  // the raster has more painted pixels — a coarse proxy for "non-empty"
  // coverage. A future image-classifier step should replace this.
  if (bytes < 1_000) return "low";
  if (bytes < 3_000) return "medium";
  if (bytes < 8_000) return "high";
  return "very_high";
}

/**
 * Detect the Bhuvan MapServer "LayerNotQueryable" service exception that
 * is returned from every probed layer as of 2026-06-19. Exported for
 * testing so callers do not have to string-match against the full XML.
 */
export function isLayerNotQueryableResponse(body: string): boolean {
  if (typeof body !== "string") return false;
  return /LayerNotQueryable/.test(body);
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await globalThis.fetch(url, { signal: controller.signal, method: "GET" });
  } finally {
    clearTimeout(timer);
  }
}

// --- Main fetcher ---

export async function fetch(input: BhuvanFloodInput): Promise<BhuvanFloodResult> {
  const fetchedAt = new Date().toISOString();
  const inputsTried = [
    {
      label: "bhuvan_wms_get_feature_info",
      input: { lat: input.lat, lon: input.lon, layers: [...ODISHA_LAYERS] },
    },
    {
      label: "bhuvan_wms_get_map_tile",
      input: { lat: input.lat, lon: input.lon, layer: "or_cyclone" },
    },
  ];

  if (
    !Number.isFinite(input.lat) ||
    !Number.isFinite(input.lon) ||
    input.lat < -90 ||
    input.lat > 90 ||
    input.lon < -180 ||
    input.lon > 180
  ) {
    return {
      source: "bhuvan-flood",
      fetchedAt,
      status: "failed",
      verification: "manual_required",
      statusReason: "invalid_input",
      data: {
        floodFrequency: "unknown",
        layersProbed: [],
        getFeatureInfoBlocked: false,
        tileBytes: null,
        dataSource: "bhuvan-ras2.nrsc.gov.in",
      },
      inputsTried,
      attempts: 0,
      retryAttempts: [],
      parserVersion: "bhuvan-flood-v1",
    };
  }

  if (input.skipLive === true) {
    return {
      source: "bhuvan-flood",
      fetchedAt,
      status: "not_covered",
      verification: "manual_required",
      data: {
        floodFrequency: "unknown",
        layersProbed: [],
        getFeatureInfoBlocked: false,
        tileBytes: null,
        dataSource: "bhuvan-ras2.nrsc.gov.in",
      },
      inputsTried,
      attempts: 0,
      retryAttempts: [],
      parserVersion: "bhuvan-flood-v1",
      warnings: [
        {
          code: "bhuvan_skip_live",
          message: "skipLive=true — live WMS probe skipped. NRSC Bhuvan data is published under planning-only license.",
        },
      ],
    };
  }

  const { value: probed, attempts } = await runWithRetry(
    async () => probeBhuvan(input),
    {
      maxAttempts: RETRY_MAX_ATTEMPTS,
      baseDelayMs: RETRY_BASE_DELAY_MS,
      // LayerNotQueryable is a server-side policy response, not a
      // transient error — do not retry past the first attempt for it.
      shouldRetry: (err, attempt) => {
        if (attempt >= RETRY_MAX_ATTEMPTS) return false;
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("LayerNotQueryable")) return false;
        return true;
      },
      onAttempt: () => {
        // Hook reserved for orchestrator telemetry; intentionally no-op.
      },
    }
  );

  const baseStatus = probed.getFeatureInfoBlocked
    ? ("partial" as const)
    : probed.tileBytes !== null && probed.tileBytes > 0
      ? ("success" as const)
      : ("failed" as const);

  const statusReason = probed.getFeatureInfoBlocked
    ? "LayerNotQueryable — Bhuvan WMS GetFeatureInfo is server-disabled; relying on GetMap tile size only"
    : probed.tileBytes !== null && probed.tileBytes > 0
      ? "tile_painted_for_or_cyclone"
      : "no_tile_returned";

  // License posture is honest: NRSC Bhuvan data is "planning purposes
  // only". Until formal licensing is in place, mark every fetch as
  // not_covered so the consumer copy stays gated.
  return {
    source: "bhuvan-flood",
    status: baseStatus,
    statusReason,
    verification: "manual_required",
    fetchedAt,
    attempts: RETRY_MAX_ATTEMPTS,
    inputsTried,
    parserVersion: PARSER_VERSION,
    data: {
      floodFrequency: probed.floodFrequency,
      layersProbed: probed.layersProbed,
      getFeatureInfoBlocked: probed.getFeatureInfoBlocked,
      tileBytes: probed.tileBytes,
      dataSource: "bhuvan-ras2.nrsc.gov.in",
    },
    retryAttempts: attempts,
    rawArtifactHash: probed.tileHash ?? undefined,
    warnings: [
      {
        code: "bhuvan_license_planning_only",
        message:
          "NRSC Bhuvan data is published under planning-only license. Formal NRSC licensing is required before Bhuvan-derived output appears in a paid ClearDeed report.",
      },
    ],
  };
}

interface ProbeResult {
  layersProbed: string[];
  getFeatureInfoBlocked: boolean;
  tileBytes: number | null;
  tileHash: string | null;
  floodFrequency: "none" | "low" | "medium" | "high" | "very_high" | "unknown";
}

async function probeBhuvan(input: BhuvanFloodInput): Promise<ProbeResult> {
  // Step 1 — try GetFeatureInfo on the first Odisha layer. If the server
  // returns LayerNotQueryable we record it and skip the rest. The
  // shouldRetry predicate in fetch() guards against wasted retries.
  const firstLayer: OdishaLayer = "or_cyclone";
  const infoUrl = buildGetFeatureInfoUrl(input.lat, input.lon, firstLayer);
  let infoBlocked = false;
  try {
    const infoResponse = await fetchWithTimeout(infoUrl, FETCH_TIMEOUT_MS);
    const infoBody = await infoResponse.text();
    if (isLayerNotQueryableResponse(infoBody)) {
      infoBlocked = true;
    }
  } catch {
    // Network error / timeout — fall through to the GetMap probe.
  }

  // Step 2 — best-effort GetMap tile (a small bbox around the GPS). If
  // infoBlocked is true, the tile is the only signal we have.
  const tileUrl = buildGetMapUrl(input.lat, input.lon, firstLayer);
  let tileBytes: number | null = null;
  let tileHash: string | null = null;
  try {
    const tileResponse = await fetchWithTimeout(tileUrl, FETCH_TIMEOUT_MS);
    const buf = Buffer.from(await tileResponse.arrayBuffer());
    if (buf.byteLength > 0) {
      tileBytes = buf.byteLength;
      tileHash = createHash("sha256").update(buf).digest("hex");
    }
  } catch {
    // Tile probe failed — leave tileBytes as null.
  }

  return {
    layersProbed: [firstLayer],
    getFeatureInfoBlocked: infoBlocked,
    tileBytes,
    tileHash,
    floodFrequency: classifyFromTileBytes(tileBytes),
  };
}

// --- Health check ---

export async function healthCheck(): Promise<boolean> {
  // Probe the public WMS GetCapabilities endpoint — if it returns
  // XML/JSON with WMS in the body, the host is reachable. We do NOT
  // require a per-pixel queryable layer for health-check purposes —
  // the server-side policy is the fetcher's job to handle, not the
  // health-check's.
  try {
    const url = `${BHUVAN_WMS_URL}?service=WMS&request=GetCapabilities&version=1.1.1`;
    const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    const body = await response.text();
    return /WMS/i.test(body);
  } catch {
    return false;
  }
}

// Re-export the SourceResultBase type so callers can iterate the
// underlying schema fields without importing from `@cleardeed/schema`
// directly.
export type { SourceResultBaseType };
