import { describe, expect, it } from "vitest";
import {
  BhulekhChauhaddi,
  BhulekhRoRDocumentV1,
  BhulekhRoRPlotRowV1,
  BhulekhSection6Area,
  RoRMutationReference,
} from "./index";

describe("bhulekh extensions schema (track A: A1)", () => {
  describe("RoRMutationReference", () => {
    it("accepts orderYear as int", () => {
      const result = RoRMutationReference.parse({
        caseType: "Mutation",
        caseNo: "123",
        orderDate: "2024-05-12",
        orderYear: 2024,
        plotNo: "415",
        newKhatiyan: "830/1",
        sourceField: "special_remarks",
        rawText: "...",
      });
      expect(result.orderYear).toBe;
      expect(result.newKhatiyan).toBe("830/1");
    });

    it("treats orderYear and newKhatiyan as optional", () => {
      const result = RoRMutationReference.parse({
        sourceField: "test",
        rawText: "...",
      });
      expect(result.orderYear).toBeUndefined();
      expect(result.newKhatiyan).toBeUndefined();
    });
  });

  describe("BhulekhChauhaddi", () => {
    it("all four sides nullable text", () => {
      const ch = BhulekhChauhaddi.parse({
        north: "Road",
        south: null,
        east: "Plot 416",
        west: null,
      });
      expect(ch.north).toBe("Road");
      expect(ch.south).toBeNull();
    });
  });

  describe("BhulekhSection6Area", () => {
    it("acres / decimals / hectares nullable text", () => {
      const area = BhulekhSection6Area.parse({
        acres: "0.05",
        decimals: "5",
        hectares: "0.0202",
      });
      expect(area.acres).toBe("0.05");
    });
  });

  describe("BhulekhRoRPlotRowV1", () => {
    it("chauhaddi is optional nested object", () => {
      const row = BhulekhRoRPlotRowV1.parse({
        plotNo: "415",
        chakNameOdia: null,
        landTypeOdia: "ଦଣ୍ଡା",
        northBoundaryOdia: null,
        southBoundaryOdia: null,
        eastBoundaryOdia: null,
        westBoundaryOdia: null,
        areaAcres: null,
        areaDecimals: null,
        areaHectares: null,
        areaUnitRaw: null,
        areaComputation: null,
        sourceRowHash: null,
        remarksOdia: null,
        chauhaddi: { north: "Road", south: "Plot 416", east: "Drain", west: "Plot 414" },
        raw: {},
      });
      expect(row.chauhaddi?.north).toBe("Road");
    });

    it("omitting chauhaddi is fine (backwards-compat)", () => {
      const row = BhulekhRoRPlotRowV1.parse({
        plotNo: "415",
        raw: {},
      });
      expect(row.chauhaddi).toBeUndefined();
    });
  });

  describe("BhulekhRoRDocumentV1", () => {
    it("record exposes khewatNo, hasPoA, ownerFieldMissing", () => {
      const doc = BhulekhRoRDocumentV1.parse({
        schemaVersion: "bhulekh-ror-v1",
        source: {
          lookupMode: "plot",
          fetchedAt: new Date().toISOString(),
          artifactType: "html",
        },
        location: {
          mouzaOdia: null,
          tehsilOdia: null,
          thanaOdia: null,
          districtOdia: null,
          tehsilNo: null,
          thanaNo: null,
        },
        record: {
          khatiyanNo: "830",
          zamindarKhewatOdia: null,
          khewatNo: "1",
          tenantNameOdia: "Test",
          guardianNameOdia: null,
          guardianRelationOdia: null,
          casteOdia: null,
          residenceOdia: null,
          rightsOdia: null,
          tenantBlockRawOdia: null,
          hasPoA: false,
          ownerFieldMissing: false,
        },
        dues: {
          jalkar: null,
          khajana: null,
          cess: null,
          otherCess: null,
          total: null,
        },
        remarks: {
          progressiveRentRawOdia: null,
          specialRemarksRawOdia: null,
          finalPublicationDate: null,
          revenueAssessmentDate: null,
          generatedAtRaw: null,
        },
        mutationReferences: [],
        plotTable: { headersOdia: [], rows: [], totals: {} },
        raw: { fullTextOdia: null, rawHtml: null, rawPdfTextOdia: null },
      });
      expect(doc.record.khewatNo).toBe("1");
      expect(doc.record.hasPoA).toBe(false);
      expect(doc.record.ownerFieldMissing).toBe(false);
    });

    it("section6 is optional with nested BhulekhSection6Area", () => {
      const doc = BhulekhRoRDocumentV1.parse({
        schemaVersion: "bhulekh-ror-v1",
        source: {
          lookupMode: "plot",
          fetchedAt: new Date().toISOString(),
          artifactType: "html",
        },
        location: {
          mouzaOdia: null,
          tehsilOdia: null,
          thanaOdia: null,
          districtOdia: null,
          tehsilNo: null,
          thanaNo: null,
        },
        record: {
          khatiyanNo: null,
          zamindarKhewatOdia: null,
          tenantNameOdia: null,
          guardianNameOdia: null,
          guardianRelationOdia: null,
          casteOdia: null,
          residenceOdia: null,
          rightsOdia: null,
          tenantBlockRawOdia: null,
        },
        dues: {
          jalkar: null,
          khajana: null,
          cess: null,
          otherCess: null,
          total: null,
        },
        remarks: {
          progressiveRentRawOdia: null,
          specialRemarksRawOdia: null,
          finalPublicationDate: null,
          revenueAssessmentDate: null,
          generatedAtRaw: null,
        },
        mutationReferences: [],
        plotTable: { headersOdia: [], rows: [], totals: {} },
        raw: { fullTextOdia: null, rawHtml: null, rawPdfTextOdia: null },
        section6: {
          area: { acres: "0.05", decimals: "5", hectares: "0.0202" },
          rawTextOdia: "...",
          referenceCount: 3,
        },
      });
      expect(doc.section6?.area?.acres).toBe("0.05");
      expect(doc.section6?.referenceCount).toBe(3);
    });

    it("hasPoA can be null (not extracted)", () => {
      const doc = BhulekhRoRDocumentV1.parse({
        schemaVersion: "bhulekh-ror-v1",
        source: {
          lookupMode: "plot",
          fetchedAt: new Date().toISOString(),
          artifactType: "html",
        },
        location: {
          mouzaOdia: null,
          tehsilOdia: null,
          thanaOdia: null,
          districtOdia: null,
          tehsilNo: null,
          thanaNo: null,
        },
        record: {
          khatiyanNo: null,
          zamindarKhewatOdia: null,
          tenantNameOdia: null,
          guardianNameOdia: null,
          guardianRelationOdia: null,
          casteOdia: null,
          residenceOdia: null,
          rightsOdia: null,
          tenantBlockRawOdia: null,
          hasPoA: null,
        },
        dues: {
          jalkar: null,
          khajana: null,
          cess: null,
          otherCess: null,
          total: null,
        },
        remarks: {
          progressiveRentRawOdia: null,
          specialRemarksRawOdia: null,
          finalPublicationDate: null,
          revenueAssessmentDate: null,
          generatedAtRaw: null,
        },
        mutationReferences: [],
        plotTable: { headersOdia: [], rows: [], totals: {} },
        raw: { fullTextOdia: null, rawHtml: null, rawPdfTextOdia: null },
      });
      expect(doc.record.hasPoA).toBeNull();
    });
  });
});