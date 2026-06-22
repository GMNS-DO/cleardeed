// agents/consumer-report-writer/src/__tests__/source-meta.test.ts
//
// Real-data sourceMeta plumbing — verifies that the mapper carries
// per-source provenance (rawArtifactHash, parserVersion, templateHash,
// inputsTried, warnings, rawOdia, casteOdia) from the SourceResult into
// the renderer's sourceDetails, so the trust strip shows real hash and
// parser info rather than demo strings.

import { describe, it, expect } from "vitest";
import { mapToReportInput } from "../mapper";
import type { SourceResult } from "@cleardeed/schema";

const RAW_BHULEKH_DOC = JSON.stringify({
  schemaVersion: "bhulekh-ror-v1",
  source: {
    lookupMode: "plot",
    finalUrl: "https://bhulekh.ori.nic.in/ROR2_3/PlotROR.aspx",
    fetchedAt: "2026-05-12T10:00:00Z",
    artifactType: "html",
    rawArtifactHash: "sha256:from-real-fetch",
  },
  location: { districtOdia: "ଖୋର୍ଦ୍ଧା" },
  record: {
    khatiyanNo: "830",
    tenantNameOdia: "ପ୍ରକାଶ ମହାପାତ୍ର",
    guardianNameOdia: "ବୀରକୃଷ୍ଣ",
    guardianRelationOdia: "ପିତା",
    casteOdia: "SC",
    residenceOdia: "ମେଣ୍ଢାସାଳ",
    rightsOdia: "ପଟ୍ଟା ରୁକା",
    ownerBlocks: [
      {
        tenantNameOdia: "ପ୍ରକାଶ ମହାପାତ୍ର",
        guardianNameOdia: "ବୀରକୃଷ୍ଣ",
        guardianRelationOdia: "ପିତା",
        casteOdia: "SC",
        residenceOdia: "ମେଣ୍ଢାସାଳ",
        landClassOdia: "ଦଣ୍ଡା",
        landClass: "Homestead",
      },
    ],
  },
  plotTable: { rows: [], totals: null },
});

function makeSource(overrides: Partial<SourceResult>): SourceResult {
  return {
    source: "bhulekh",
    status: "success",
    fetchedAt: "2026-05-12T10:00:00Z",
    parserVersion: "Bhulekh v3.2",
    rawArtifactHash: "sha256:abc123def456",
    templateHash: "sha256:template789",
    inputsTried: [
      { label: "plot", input: { plotNo: "309", khataNo: "94" } },
      { label: "khata", input: { khataNo: "94" } },
    ],
    warnings: [],
    rawResponse: RAW_BHULEKH_DOC,
    ...overrides,
  } as SourceResult;
}

describe("mapToReportInput — sourceDetails carries real provenance", () => {
  it("propagates rawArtifactHash, parserVersion, templateHash, inputsTried from SourceResult into sourceDetails.bhulekh", () => {
    const source = makeSource({});
    const reportInput = mapToReportInput(
      {
        reportId: "rpt-1",
        sources: [source],
        completedAt: "2026-05-12T10:01:00Z",
        validationFindings: [],
        igrLink: { url: "https://igrodisha.gov.in/ecsearch", params: {} },
      },
      {
        gps: { lat: 20.27, lon: 85.84 },
        claimedOwnerName: "Prakash Mohapatra",
        disclaimerText: "test",
      }
    );

    const sd = (reportInput as any).sourceDetails.bhulekh;
    expect(sd).toBeDefined();
    expect(sd.rawArtifactHash).toBe("sha256:abc123def456");
    expect(sd.parserVersion).toBe("Bhulekh v3.2");
    expect(sd.templateHash).toBe("sha256:template789");
    expect(sd.inputsTried).toEqual([
      { label: "plot", input: { plotNo: "309", khataNo: "94" } },
      { label: "khata", input: { khataNo: "94" } },
    ]);
    expect(sd.fetchedAt).toBe("2026-05-12T10:00:00Z");
  });

  it("extracts rawOdia and casteOdia from the first ownerBlock for the trust strip", () => {
    const source = makeSource({});
    const reportInput = mapToReportInput(
      {
        reportId: "rpt-1",
        sources: [source],
        completedAt: "2026-05-12T10:01:00Z",
        validationFindings: [],
        igrLink: { url: "https://igrodisha.gov.in/ecsearch", params: {} },
      },
      {
        gps: { lat: 20.27, lon: 85.84 },
        claimedOwnerName: "Prakash Mohapatra",
        disclaimerText: "test",
      }
    );

    const sd = (reportInput as any).sourceDetails.bhulekh;
    expect(sd.rawOdia).toEqual({
      odia: "ଦଣ୍ଡା",
      english: "Homestead",
    });
    expect(sd.casteOdia).toBe("SC");
  });

  it("returns minimal sourceDetails when warnings empty, source succeeded", () => {
    const source = makeSource({ warnings: [] });
    const reportInput = mapToReportInput(
      {
        reportId: "rpt-1",
        sources: [source],
        completedAt: "2026-05-12T10:01:00Z",
        validationFindings: [],
        igrLink: { url: "https://igrodisha.gov.in/ecsearch", params: {} },
      },
      {
        gps: { lat: 20.27, lon: 85.84 },
        claimedOwnerName: "Prakash Mohapatra",
        disclaimerText: "test",
      }
    );

    const sd = (reportInput as any).sourceDetails.bhulekh;
    expect(sd.warnings).toEqual([]);
    expect(sd.status).toBe("success");
  });

  it("falls back to no rawOdia/casteOdia when ownerBlocks is empty", () => {
    const rawDocNoOwner = JSON.stringify({
      ...JSON.parse(RAW_BHULEKH_DOC),
      record: { ...JSON.parse(RAW_BHULEKH_DOC).record, ownerBlocks: [] },
    });
    const source = makeSource({ rawResponse: rawDocNoOwner });
    const reportInput = mapToReportInput(
      {
        reportId: "rpt-1",
        sources: [source],
        completedAt: "2026-05-12T10:01:00Z",
        validationFindings: [],
        igrLink: { url: "https://igrodisha.gov.in/ecsearch", params: {} },
      },
      {
        gps: { lat: 20.27, lon: 85.84 },
        claimedOwnerName: "Prakash Mohapatra",
        disclaimerText: "test",
      }
    );

    const sd = (reportInput as any).sourceDetails.bhulekh;
    expect(sd.rawOdia).toBeUndefined();
    expect(sd.casteOdia).toBeUndefined();
  });
});
