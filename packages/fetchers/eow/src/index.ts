/**
 * EOW (Economic Offences Wing) Khordha blacklist fetcher.
 *
 * Purpose
 * ───────
 * Implements the Surya Nirman Multi-Investor Fraud (Bhubaneswar 2017-2023)
 * detection rule from CLAUDE.md Section 8.1 (Fraud Pattern 2):
 *
 *   - cross-reference plot/khata against `khordha_eow_blacklist.json` → CRITICAL
 *   - cross-reference owner name against EOW arrest list → HIGH WATCH-OUT
 *
 * The fetcher is split into two surfaces:
 *
 *   1. `fetch()` — periodic refresh of the on-disk blacklist. The current
 *      implementation is offline: eowodisha.gov.in does not resolve from
 *      the build environment and the live site has not been probed
 *      successfully. When the live site is reachable, `fetch()` should walk
 *      the press-release index, parse each release, and merge the new
 *      properties / arrested persons into the blacklist.
 *
 *   2. `matchBlacklist()` — synchronous query against the on-disk
 *      blacklist. This is the only surface the orchestrator needs: it
 *      accepts a plot + khata + village + owner name and returns a
 *      structured `EOWMatchResult` with severity, matched entries, and
 *      source URLs.
 *
 * The blacklist file is the durable source of truth. `matchBlacklist()`
 * never performs network I/O; refresh is a separate concern owned by
 * `fetch()` and the probe script.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  EOW_SOURCE,
  PARSER_VERSION,
  loadBlacklist,
  matchOwner,
  matchPlot,
  saveBlacklist,
  type EOWArrestedPerson,
  type EOWAttachedProperty,
  type KhordhaEOWBlacklist,
} from "./blacklist";
import { parsePressRelease, type ParsedPressRelease } from "./parse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Known endpoints on the EOW Odisha site. The current live domain
 * `eowodisha.gov.in` does not resolve from the build environment; the
 * additional paths are listed for future probe work and the script
 * deliberately tries each one in order, capturing the failure mode.
 */
export const EOW_BASE_URLS = [
  "https://eowodisha.gov.in",
  "https://eow.odisha.gov.in",
  "https://eowodisha.nic.in",
] as const;

/**
 * Press-release listing endpoints to probe, in order. Most state EOW sites
 * put press releases under one of /press-release, /news, /notices, /media.
 */
export const EOW_PRESS_PATHS = [
  "/press-release",
  "/press-release.html",
  "/press_releases",
  "/news",
  "/news.html",
  "/notices",
  "/media",
  "/",
] as const;

/**
 * Public input type for `matchBlacklist()` — the orchestrator passes the
 * buyer-side query. Every field is optional except `ownerName`, because
 * the Surya Nirman fraud is primarily detected through the owner name
 * and then confirmed via plot/khata.
 */
export interface EOWQuery {
  plotNo?: string;
  khataNo?: string;
  village?: string;
  ownerName: string;
}

/**
 * Result of a blacklist query. The `matched: false` shape is the common
 * case — most Khordha plots are not on the EOW list. The orchestrator
 * must surface a `matched: true` result as a CRITICAL or HIGH WATCH-OUT
 * insight per CLAUDE.md Section 8.1.
 */
export interface EOWMatchResult {
  source: "eow";
  status: "success" | "partial" | "failed";
  verification: "verified" | "unverified" | "manual_required" | "error";
  fetchedAt: string;
  data?: {
    plotMatch: ReturnType<typeof matchPlot>;
    ownerMatch: ReturnType<typeof matchOwner>;
    overallSeverity?: "critical" | "high_watch_out";
    overallSummary?: string;
    blacklistVersion: string;
    blacklistLastRefreshedAt: string;
    entryCount: number;
  };
  statusReason?: string;
  parserVersion: string;
}

/**
 * Refresh-style fetch. This is the surface that the orchestrator would
 * call on a schedule (e.g. monthly). It is intentionally conservative
 * because the live EOW site is currently unreachable from the build
 * environment; the function returns `partial` with a clear `statusReason`
 * rather than failing hard.
 *
 * If a list of press release HTMLs is supplied via `input.pressReleases`,
 * the function parses each one, merges the results into the blacklist,
 * and returns the merged blacklist. This is the path the probe script
 * uses after capturing HTMLs out-of-band.
 */
export interface EOWFetchInput {
  /** Pre-fetched press-release HTMLs to merge into the blacklist. */
  pressReleases?: Array<{ html: string; sourceUrl: string; publishedAt?: string }>;
  /** Custom path to the on-disk blacklist (used by tests). */
  blacklistPath?: string;
}

export interface EOWFetchResult {
  source: "eow";
  status: "success" | "partial" | "failed";
  fetchedAt: string;
  data?: {
    blacklist: KhordhaEOWBlacklist;
    parsedReleases: ParsedPressRelease[];
  };
  statusReason?: string;
  parserVersion: string;
  rawArtifactRef?: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function defaultBlacklistPath(): string {
  // From packages/fetchers/eow/src/index.ts, walk up one level to
  // packages/fetchers/eow/, then into data/.
  return join(__dirname, "..", "data", "khordha_eow_blacklist.json");
}

/**
 * Refresh-style fetch. See `EOWFetchInput` for semantics.
 *
 * Behavior:
 *  - If `pressReleases` is empty/undefined and the live site is unreachable
 *    (the current state), the function returns `partial` with a structured
 *    `statusReason` explaining the offline posture. The on-disk blacklist
 *    is still loaded and returned so downstream callers can match against
 *    whatever entries are already curated.
 *  - If `pressReleases` is supplied, each one is parsed and merged.
 */
export async function fetch(input: EOWFetchInput = {}): Promise<EOWFetchResult> {
  const fetchedAt = new Date().toISOString();
  const blacklistPath = input.blacklistPath ?? defaultBlacklistPath();
  const blacklist = loadBlacklist(blacklistPath);

  if (!input.pressReleases || input.pressReleases.length === 0) {
    // Live site unreachable from the build environment; we cannot refresh
    // automatically. Return the curated blacklist as it stands.
    return {
      source: EOW_SOURCE,
      status: "partial",
      fetchedAt,
      data: { blacklist, parsedReleases: [] },
      statusReason: existsSync(blacklistPath)
        ? `EOW live site unreachable from build environment; returning last curated blacklist (${blacklist.properties.length} properties, ${blacklist.arrestedPersons.length} arrested persons, last refreshed ${blacklist.lastRefreshedAt}).`
        : `EOW live site unreachable from build environment; no curated blacklist on disk yet.`,
      parserVersion: PARSER_VERSION,
      rawArtifactRef: `eow-offline-${sha256(blacklistPath)}`,
    };
  }

  const parsed: ParsedPressRelease[] = [];
  for (const pr of input.pressReleases) {
    parsed.push(
      parsePressRelease({
        html: pr.html,
        sourceUrl: pr.sourceUrl,
        publishedAt: pr.publishedAt,
      })
    );
  }
  const merged = mergePressReleases(blacklist, parsed);
  saveBlacklist(merged, blacklistPath);
  return {
    source: EOW_SOURCE,
    status: "success",
    fetchedAt,
    data: { blacklist: merged, parsedReleases: parsed },
    parserVersion: PARSER_VERSION,
    rawArtifactRef: `eow-refresh-${sha256(fetchedAt)}`,
  };
}

/**
 * Merge a batch of freshly-parsed press releases into the existing
 * blacklist. Idempotent: existing entries (matched by `id`) are not
 * duplicated; new entries are appended; existing entries whose source
 * press release was re-issued with stronger confidence are upgraded.
 */
export function mergePressReleases(
  existing: KhordhaEOWBlacklist,
  releases: ParsedPressRelease[]
): KhordhaEOWBlacklist {
  const props = new Map<string, EOWAttachedProperty>();
  for (const p of existing.properties) props.set(p.id, p);
  const persons = new Map<string, EOWArrestedPerson>();
  for (const p of existing.arrestedPersons) persons.set(p.id, p);

  for (const release of releases) {
    for (const prop of release.properties) {
      const prev = props.get(prop.id);
      if (!prev) {
        props.set(prop.id, prop);
      } else if (prev.confidence === "probable" && prop.confidence === "verified") {
        props.set(prop.id, prop);
      }
    }
    for (const person of release.arrestedPersons) {
      const prev = persons.get(person.id);
      if (!prev) {
        persons.set(person.id, person);
      } else if (prev.confidence === "probable" && person.confidence === "verified") {
        persons.set(person.id, person);
      }
    }
  }

  return {
    ...existing,
    properties: Array.from(props.values()),
    arrestedPersons: Array.from(persons.values()),
    lastRefreshedAt: new Date().toISOString(),
  };
}

/**
 * Query-side: check a buyer query against the on-disk blacklist.
 *
 * This is the only function the orchestrator needs to call. It loads the
 * blacklist, runs `matchPlot` and `matchOwner`, and combines the results
 * into a single EOWMatchResult.
 *
 * Severity precedence (per CLAUDE.md Section 8.1):
 *   1. plotMatch.matched === true → CRITICAL
 *   2. ownerMatch.matched === true → HIGH WATCH-OUT
 *   3. neither matched → success / no EOW record
 */
export function matchBlacklist(input: EOWQuery): EOWMatchResult {
  const fetchedAt = new Date().toISOString();
  const blacklist = loadBlacklist();

  const plotMatch = matchPlot(blacklist, {
    plotNo: input.plotNo ?? "",
    khataNo: input.khataNo,
    village: input.village,
  });
  const ownerMatch = matchOwner(blacklist, input.ownerName);

  let overallSeverity: "critical" | "high_watch_out" | undefined;
  let overallSummary: string | undefined;
  if (plotMatch.matched) {
    overallSeverity = "critical";
    overallSummary = plotMatch.summary;
  } else if (ownerMatch.matched) {
    overallSeverity = "high_watch_out";
    overallSummary = ownerMatch.summary;
  }

  return {
    source: EOW_SOURCE,
    status: "success",
    verification: overallSeverity ? "verified" : "manual_required",
    fetchedAt,
    data: {
      plotMatch,
      ownerMatch,
      overallSeverity,
      overallSummary,
      blacklistVersion: blacklist.version,
      blacklistLastRefreshedAt: blacklist.lastRefreshedAt,
      entryCount: blacklist.properties.length + blacklist.arrestedPersons.length,
    },
    parserVersion: PARSER_VERSION,
  };
}

/**
 * Health check. Returns `{ ok: true }` only if a curated blacklist is
 * present on disk. The live site probe is intentionally not part of the
 * health check because the build environment cannot reach EOW.
 */
export async function healthCheck(
  blacklistPath?: string
): Promise<{ ok: boolean; reason?: string; entryCount?: number }> {
  const path = blacklistPath ?? defaultBlacklistPath();
  if (!existsSync(path)) {
    return { ok: false, reason: "No curated blacklist on disk; run scripts/probe-eow.mjs to bootstrap." };
  }
  const list = loadBlacklist(path);
  if (list.properties.length === 0 && list.arrestedPersons.length === 0) {
    return { ok: false, reason: "Curated blacklist is empty; awaiting first successful refresh.", entryCount: 0 };
  }
  return { ok: true, entryCount: list.properties.length + list.arrestedPersons.length };
}

export {
  parsePressRelease,
  type ParsedPressRelease,
} from "./parse";
export {
  type KhordhaEOWBlacklist,
  type EOWAttachedProperty,
  type EOWArrestedPerson,
} from "./blacklist";
