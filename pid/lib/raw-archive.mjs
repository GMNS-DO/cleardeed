import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, writeFile, appendFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export const DEFAULT_USER_AGENT =
  "ClearDeed-PID/0.1 raw evidence collector (research; public documents only)";

export function sha256(bufferOrString) {
  return createHash("sha256").update(bufferOrString).digest("hex");
}

export function utcDateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function safeSlug(value, fallback = "artifact") {
  const slug = String(value ?? "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return slug || fallback;
}

export function inferArtifactType(url, contentType = "") {
  const lowerUrl = String(url).toLowerCase();
  const lowerType = String(contentType).toLowerCase();
  if (lowerType.includes("application/json") || lowerUrl.endsWith(".json")) return "json";
  if (lowerType.includes("application/pdf") || lowerUrl.endsWith(".pdf")) return "pdf";
  if (lowerType.includes("image/png") || lowerUrl.endsWith(".png")) return "png";
  if (lowerType.includes("image/jpeg") || lowerUrl.endsWith(".jpg") || lowerUrl.endsWith(".jpeg")) return "jpg";
  if (lowerType.includes("text/html") || lowerUrl.includes(".php") || lowerUrl.endsWith("/")) return "html";
  return extname(new URL(url).pathname).replace(".", "") || "bin";
}

export class RawArchive {
  constructor({ root = "pid/data/raw", runDate = utcDateStamp(), collectorVersion = "wave1-raw-collector-v1" } = {}) {
    this.root = root;
    this.runDate = runDate;
    this.collectorVersion = collectorVersion;
  }

  sourceDir(sourceId) {
    return join(this.root, sourceId, this.runDate);
  }

  artifactPath(sourceId, artifactId, artifactType) {
    return join(this.sourceDir(sourceId), "artifacts", `${artifactId}.${artifactType}`);
  }

  extractedPath(sourceId, artifactId, artifactType = "json") {
    return join(this.sourceDir(sourceId), "extracted", `${artifactId}.${artifactType}`);
  }

  manifestPath(sourceId) {
    return join(this.sourceDir(sourceId), "manifest.jsonl");
  }

  async artifactExists(sourceId, artifactId, artifactType) {
    return pathExists(this.artifactPath(sourceId, artifactId, artifactType));
  }

  async artifactExistsAny(sourceId, artifactId) {
    const artifactDir = join(this.sourceDir(sourceId), "artifacts");
    try {
      const files = await readdir(artifactDir);
      return files.some((file) => file.startsWith(`${artifactId}.`));
    } catch {
      return false;
    }
  }

  async derivedExists(sourceId, artifactId, artifactType = "json") {
    return pathExists(this.extractedPath(sourceId, artifactId, artifactType));
  }

  async ensureSource(sourceId) {
    await mkdir(join(this.sourceDir(sourceId), "artifacts"), { recursive: true });
    await mkdir(join(this.sourceDir(sourceId), "extracted"), { recursive: true });
  }

  async saveFetchedArtifact({
    sourceId,
    artifactId,
    artifactType,
    sourceUrl,
    query = {},
    accessMode = "public_web",
    httpStatus,
    contentType,
    body,
    parseStatus = "raw_saved",
    notes,
    skipIfExists = false,
  }) {
    await this.ensureSource(sourceId);
    const storagePath = this.artifactPath(sourceId, artifactId, artifactType);
    if (skipIfExists && await pathExists(storagePath)) {
      return {
        artifact_id: artifactId,
        source_id: sourceId,
        artifact_type: artifactType,
        source_url: sourceUrl,
        storage_path: storagePath,
        parse_status: "skipped_existing",
        skipped_existing: true,
      };
    }
    await mkdir(dirname(storagePath), { recursive: true });
    await writeFile(storagePath, body);
    const hash = sha256(body);
    const manifestRow = {
      artifact_id: artifactId,
      source_id: sourceId,
      artifact_type: artifactType,
      source_url: sourceUrl,
      retrieved_at: new Date().toISOString(),
      query,
      storage_path: storagePath,
      sha256: hash,
      http_status: httpStatus,
      content_type: contentType,
      access_mode: accessMode,
      collector_version: this.collectorVersion,
      parse_status: parseStatus,
      notes,
    };
    await appendFile(this.manifestPath(sourceId), `${JSON.stringify(manifestRow)}\n`);
    return manifestRow;
  }

  async saveDerivedJson(sourceId, artifactId, value, { skipIfExists = false } = {}) {
    await this.ensureSource(sourceId);
    const storagePath = this.extractedPath(sourceId, artifactId, "json");
    if (skipIfExists && await pathExists(storagePath)) return storagePath;
    await writeFile(storagePath, `${JSON.stringify(value, null, 2)}\n`);
    return storagePath;
  }
}

export async function fetchBuffer(
  url,
  {
    userAgent = DEFAULT_USER_AGENT,
    timeoutMs = 30_000,
    insecure = false,
    method = "GET",
    headers = {},
    body: requestBody,
    failOnHttpError = true,
  } = {},
) {
  const args = [
    "-L",
    "--compressed",
    "--max-time",
    String(Math.ceil(timeoutMs / 1000)),
    "-A",
    userAgent,
  ];
  if (insecure) args.unshift("-k");
  if (failOnHttpError) args.unshift("-f");
  if (method && method.toUpperCase() !== "GET") args.push("-X", method.toUpperCase());
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined && value !== null) args.push("-H", `${name}: ${value}`);
  }
  if (requestBody !== undefined) {
    const bodyString = Buffer.isBuffer(requestBody) ? requestBody.toString("utf8") : String(requestBody);
    args.push("--data-raw", bodyString);
  }
  args.push("-w", "\n%{http_code}\n%{content_type}", url);

  const { stdout } = await execFileAsync("curl", args, {
    encoding: "buffer",
    maxBuffer: 80 * 1024 * 1024,
  });

  const marker = Buffer.from("\n");
  const lastNewline = stdout.lastIndexOf(marker);
  const contentType = stdout.subarray(lastNewline + 1).toString("utf8").trim();
  const beforeType = stdout.subarray(0, lastNewline);
  const statusNewline = beforeType.lastIndexOf(marker);
  const httpStatus = Number(beforeType.subarray(statusNewline + 1).toString("utf8").trim());
  const body = beforeType.subarray(0, statusNewline);
  return { body, httpStatus, contentType };
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export function absolutizeUrl(baseUrl, href) {
  return new URL(href, baseUrl).toString();
}

export function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
