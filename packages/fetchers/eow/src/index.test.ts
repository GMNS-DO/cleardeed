import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  fetch,
  matchBlacklist,
  healthCheck,
  mergePressReleases,
  parsePressRelease,
  type KhordhaEOWBlacklist,
} from "./index";
import {
  loadBlacklist,
  saveBlacklist,
  matchPlot,
  matchOwner,
  normalizePlotNo,
  normalizeName,
} from "./blacklist";

// The parser targets the structure observed in archived EOW press releases
// and in the documented Surya Nirman case (Orissa High Court 2023). It is
// a synthetic fixture; the live eowodisha.gov.in is unreachable from the
// build environment (see fixtures/probe-result.json).
const SAMPLE_HTML = readFileSync(
  join(__dirname, "..", "fixtures", "press-release-sample.html"),
  "utf-8"
);

const SAMPLE_URL = "https://eowodisha.gov.in/press-release/surya-nirman-2023-10-15";

describe("parsePressRelease", () => {
  it("extracts case reference, plots, khata, and arrested persons from a Surya Nirman press release", () => {
    const parsed = parsePressRelease({
      html: SAMPLE_HTML,
      sourceUrl: SAMPLE_URL,
    });
    expect(parsed.parserVersion).toMatch(/^eow-press-release-v\d+/);
    expect(parsed.caseRef).toMatch(/07\/2023|OPID/);
    expect(parsed.properties.length).toBeGreaterThanOrEqual(3);
    const plots = parsed.properties.map((p) => p.plotNo);
    expect(plots).toContain("415");
    expect(plots).toContain("309");
    expect(plots).toContain("128");
    const plot415 = parsed.properties.find((p) => p.plotNo === "415");
    expect(plot415?.khataNo).toBe("94");
    expect(plot415?.village?.toLowerCase()).toContain("mendhasala");
    expect(parsed.arrestedPersons.length).toBeGreaterThanOrEqual(3);
    const names = parsed.arrestedPersons.map((p) => p.name);
    expect(names.some((n) => n.toLowerCase().includes("arun kumar"))).toBe(true);
    expect(names.some((n) => n.toLowerCase().includes("pradeep kumar"))).toBe(true);
    expect(parsed.confidence).toBe("verified");
  });

  it("returns manual_required when the press release has no recognizable case reference", () => {
    const parsed = parsePressRelease({
      html: "<html><body><p>Just a notice, no case details.</p></body></html>",
      sourceUrl: "https://example.com/notice",
    });
    expect(parsed.caseRef).toBe("");
    expect(parsed.confidence).toBe("manual_required");
    expect(parsed.properties).toEqual([]);
    expect(parsed.arrestedPersons).toEqual([]);
  });

  it("decodes common HTML entities and strips script/style blocks", () => {
    const html = `
      <html><body>
        <script>var x = 1;</script>
        <style>p { color: red; }</style>
        <h1>EOW P.S. Case No. 12/2022 &mdash; press release</h1>
        <p>Plot No. 88 of Khata No. 7, Village &quot;Mendhasala&quot;.</p>
        <p>Arun Kumar Sahu, Director, M/s Surya Nirman Resources, aged 50.</p>
      </body></html>
    `;
    const parsed = parsePressRelease({ html, sourceUrl: "https://example.com/pr-12-2022" });
    expect(parsed.caseRef).toMatch(/12\/2022/);
    expect(parsed.properties.length).toBe(1);
    expect(parsed.properties[0].plotNo).toBe("88");
    expect(parsed.properties[0].khataNo).toBe("7");
    expect(parsed.arrestedPersons.length).toBeGreaterThan(0);
    expect(parsed.arrestedPersons[0].name).toContain("Arun");
  });
});

describe("blacklist matching", () => {
  let tmpDir: string;
  let tmpBlacklistPath: string;
  let seeded: KhordhaEOWBlacklist;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "eow-test-"));
    tmpBlacklistPath = join(tmpDir, "blacklist.json");
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Seed a deterministic blacklist for every test so matches are
    // independent of execution order.
    const parsed = parsePressRelease({ html: SAMPLE_HTML, sourceUrl: SAMPLE_URL });
    seeded = {
      version: "eow-blacklist-v1",
      lastRefreshedAt: new Date().toISOString(),
      source: "eow-odisha",
      properties: parsed.properties,
      arrestedPersons: parsed.arrestedPersons,
      contentHash: "test-hash",
    };
    saveBlacklist(seeded, tmpBlacklistPath);
  });

  it("matchPlot returns CRITICAL when plot number matches an attached property", () => {
    const result = matchPlot(seeded, {
      plotNo: "415",
      khataNo: "94",
      village: "Mendhasala",
    });
    expect(result.matched).toBe(true);
    expect(result.severity).toBe("critical");
    expect(result.entryIds.length).toBeGreaterThan(0);
    expect(result.caseRefs[0]).toMatch(/07\/2023/);
  });

  it("matchOwner returns HIGH WATCH-OUT for full-name match and partial for surname-only", () => {
    const fullMatch = matchOwner(seeded, "Arun Kumar Sahu");
    expect(fullMatch.matched).toBe(true);
    expect(fullMatch.severity).toBe("high_watch_out");
    expect(fullMatch.matchStrength).toBe("full");

    const partial = matchOwner(seeded, "Sahu");
    expect(partial.matched).toBe(true);
    expect(partial.matchStrength).toBe("partial");

    const noMatch = matchOwner(seeded, "Some Random Person");
    expect(noMatch.matched).toBe(false);
  });

  it("matchBlacklist orchestrates plot + owner checks and chooses the right severity", () => {
    // Critical path: plot match wins.
    const plotResult = matchBlacklist({
      plotNo: "415",
      khataNo: "94",
      village: "Mendhasala",
      ownerName: "Random Person",
    });
    expect(plotResult.data?.overallSeverity).toBe("critical");

    // High watch-out path: owner match only.
    const ownerResult = matchBlacklist({
      plotNo: "9999",
      ownerName: "Arun Kumar Sahu",
    });
    expect(ownerResult.data?.overallSeverity).toBe("high_watch_out");

    // No match: clean report.
    const clean = matchBlacklist({
      plotNo: "9999",
      village: "Random",
      ownerName: "Random Person",
    });
    expect(clean.data?.overallSeverity).toBeUndefined();
    expect(clean.data?.plotMatch.matched).toBe(false);
    expect(clean.data?.ownerMatch.matched).toBe(false);
  });
});

describe("loadBlacklist / saveBlacklist", () => {
  it("returns an empty blacklist when the file does not exist", () => {
    const list = loadBlacklist("/tmp/definitely-does-not-exist-eow-12345.json");
    expect(list.properties).toEqual([]);
    expect(list.arrestedPersons).toEqual([]);
    expect(list.version).toBe("eow-blacklist-v1");
  });

  it("round-trips a blacklist through disk", () => {
    const tmp = mkdtempSync(join(tmpdir(), "eow-roundtrip-"));
    const path = join(tmp, "blacklist.json");
    const initial: KhordhaEOWBlacklist = {
      version: "eow-blacklist-v1",
      lastRefreshedAt: new Date().toISOString(),
      source: "eow-odisha",
      properties: [
        {
          id: "test-1",
          caseRef: "EOW P.S. Case No. 99/2024",
          plotNo: "42",
          khataNo: "7",
          village: "Mendhasala",
          confidence: "verified",
          sourceUrl: "https://example.com/pr",
          sourcePublishedAt: new Date().toISOString(),
        },
      ],
      arrestedPersons: [
        {
          id: "test-p-1",
          caseRef: "EOW P.S. Case No. 99/2024",
          name: "Test Person",
          confidence: "verified",
          sourceUrl: "https://example.com/pr",
          sourcePublishedAt: new Date().toISOString(),
        },
      ],
      contentHash: "init",
    };
    const hash = saveBlacklist(initial, path);
    expect(existsSync(path)).toBe(true);
    const loaded = loadBlacklist(path);
    expect(loaded.properties.length).toBe(1);
    expect(loaded.properties[0].plotNo).toBe("42");
    expect(loaded.arrestedPersons[0].name).toBe("Test Person");
    expect(loaded.contentHash).toBe(hash);
    rmSync(tmp, { recursive: true, force: true });
  });
});

describe("mergePressReleases", () => {
  it("is idempotent and upgrades probable entries to verified on stronger signal", () => {
    const release = parsePressRelease({ html: SAMPLE_HTML, sourceUrl: SAMPLE_URL });
    const base: KhordhaEOWBlacklist = {
      version: "eow-blacklist-v1",
      lastRefreshedAt: new Date(0).toISOString(),
      source: "eow-odisha",
      properties: release.properties.map((p) => ({ ...p, confidence: "probable" })),
      arrestedPersons: release.arrestedPersons.map((p) => ({ ...p, confidence: "probable" })),
      contentHash: "init",
    };
    const once = mergePressReleases(base, [release]);
    expect(once.properties.length).toBe(base.properties.length);
    // Re-merging the same release must not duplicate entries.
    const twice = mergePressReleases(once, [release]);
    expect(twice.properties.length).toBe(once.properties.length);
    // A second release carrying the same entries at higher confidence
    // upgrades them, it does not duplicate them.
    const upgradedRelease: typeof release = {
      ...release,
      properties: release.properties.map((p) => ({ ...p, confidence: "verified" })),
      arrestedPersons: release.arrestedPersons.map((p) => ({ ...p, confidence: "verified" })),
    };
    const three = mergePressReleases(twice, [upgradedRelease]);
    expect(three.properties.length).toBe(twice.properties.length);
    expect(three.properties.every((p) => p.confidence === "verified")).toBe(true);
  });
});

describe("fetch()", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "eow-fetch-"));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns partial + offline statusReason when no press releases are supplied", async () => {
    const result = await fetch({ blacklistPath: join(tmpDir, "blank.json") });
    expect(result.status).toBe("partial");
    expect(result.statusReason).toMatch(/unreachable|curated|empty/i);
    expect(result.parserVersion).toBe("eow-blacklist-v1");
  });

  it("parses supplied press releases and persists them to disk", async () => {
    const path = join(tmpDir, "from-pr.json");
    const result = await fetch({
      pressReleases: [{ html: SAMPLE_HTML, sourceUrl: SAMPLE_URL }],
      blacklistPath: path,
    });
    expect(result.status).toBe("success");
    expect(result.data?.blacklist.properties.length).toBeGreaterThan(0);
    expect(result.data?.blacklist.arrestedPersons.length).toBeGreaterThan(0);
    expect(existsSync(path)).toBe(true);
    const reloaded = loadBlacklist(path);
    expect(reloaded.properties.length).toBeGreaterThan(0);
  });
});

describe("healthCheck", () => {
  let tmpDir: string;
  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "eow-health-"));
  });
  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns not-ok when no curated blacklist exists", async () => {
    // Use a tmp empty file so the test is independent of the committed
    // default — the default may legitimately be seeded with real entries
    // (T-049 surfaced this when the JSON was populated). The safe-default
    // semantics we are testing is "empty on-disk file ⇒ ok=false with a
    // defined reason".
    const emptyPath = join(tmpDir, "empty-blacklist.json");
    writeFileSync(
      emptyPath,
      JSON.stringify({
        version: "eow-blacklist-v1",
        lastRefreshedAt: new Date(0).toISOString(),
        source: "eow-odisha",
        properties: [],
        arrestedPersons: [],
        contentHash: "empty-test",
      })
    );
    const result = await healthCheck(emptyPath);
    expect(result.ok).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("returns ok when a curated blacklist with entries exists", async () => {
    // Use a tmp seeded file so the test stays independent of the committed
    // default; the orchestrator health check just needs to confirm a
    // populated blacklist returns ok=true.
    const seededPath = join(tmpDir, "seeded-blacklist.json");
    writeFileSync(
      seededPath,
      JSON.stringify({
        version: "eow-blacklist-v1",
        lastRefreshedAt: new Date().toISOString(),
        source: "eow-odisha",
        properties: [
          {
            id: "h-prop-001",
            caseRef: "EOW/KHD/2023/0042",
            attachmentDate: "2023-09-14",
            plotNo: "415",
            khataNo: "94",
            village: "Mendhasala",
            description: "test",
            confidence: "verified",
            sourceUrl: "https://example.com",
            sourcePublishedAt: "2023-09-14",
          },
        ],
        arrestedPersons: [
          {
            id: "h-arr-001",
            caseRef: "EOW/KHD/2023/0042",
            name: "Test Person",
            role: "Test",
            arrestDate: "2023-08-22",
            confidence: "verified",
            sourceUrl: "https://example.com",
            sourcePublishedAt: "2023-08-22",
          },
        ],
        contentHash: "test",
      })
    );
    const result = await healthCheck(seededPath);
    expect(result.ok).toBe(true);
    expect(result.entryCount).toBeGreaterThan(0);
  });
});

describe("normalizers", () => {
  it("normalizePlotNo strips prefixes and punctuation but preserves sub-plot slashes and letter prefixes", () => {
    expect(normalizePlotNo("Plot No. 415")).toBe("415");
    expect(normalizePlotNo("Plot 415/1")).toBe("415/1");
    expect(normalizePlotNo("D-88")).toBe("d-88");
    expect(normalizePlotNo("  Plot #  9 / 2  ")).toBe("9/2");
    expect(normalizePlotNo("")).toBe("");
    expect(normalizePlotNo(null)).toBe("");
  });

  it("normalizeName lowercases, strips punctuation, and collapses whitespace", () => {
    expect(normalizeName("Krushnachandra Barajena")).toBe("krushnachandra barajena");
    expect(normalizeName("  Arun  Kumar  ")).toBe("arun kumar");
    expect(normalizeName("O'Brien")).toBe("obrien");
  });
});
