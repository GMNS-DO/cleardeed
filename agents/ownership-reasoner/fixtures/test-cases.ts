/**
 * OwnershipReasoner (A5) — Test Cases
 *
 * Known-correct inputs for A5 name-matching logic.
 * Each case: { input, expected partial fields }
 */
import type { OwnershipReasonerInput } from "../index";

export interface TestCase {
  description: string;
  input: OwnershipReasonerInput;
  expected: {
    nameMatch: "exact" | "partial" | "mismatch" | "unknown";
    confidenceMin: number;
    confidenceMax: number;
    method?: string; // optional — only check if specified
  };
}

export const TEST_CASES: TestCase[] = [
  {
    description: "Exact transliteration match (Krushnachandra Barajena)",
    input: {
      claimedOwnerName: "Krushnachandra Barajena",
      fatherHusbandName: "Pratima Chandra Barajena",
      rorDocument: {
        khatiyanNo: "830",
        village: "Mendhasala",
        tenants: [
          {
            tenantName: "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା",
            fatherHusbandName: "ପ୍ରତିମା ଚନ୍ଦ୍ର ବଡ଼ଯେନା",
            surveyNo: "309",
            area: 10.5,
            landClass: "ଦଣ୍ଡା",
          },
        ],
      },
    },
    expected: {
      nameMatch: "exact",
      confidenceMin: 0.85,
      confidenceMax: 1.0,
    },
  },
  {
    description: "Surname mismatch — Mohapatra vs Barajena",
    input: {
      claimedOwnerName: "Mohapatra",
      rorDocument: {
        khatiyanNo: "830",
        village: "Mendhasala",
        tenants: [
          {
            tenantName: "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା",
            fatherHusbandName: "ପ୍ରତିମା ଚନ୍ଦ୍ର ବଡ଼ଯେନା",
            surveyNo: "309",
            area: 10.5,
            landClass: "ଦଣ୍ଡା",
          },
        ],
      },
    },
    expected: {
      nameMatch: "mismatch",
      confidenceMin: 0,
      confidenceMax: 0.3,
    },
  },
  {
    description: "Father's name match (Pratima Chandra Barajena)",
    input: {
      claimedOwnerName: "Pratima Chandra Barajena",
      rorDocument: {
        khatiyanNo: "830",
        village: "Mendhasala",
        tenants: [
          {
            tenantName: "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା",
            fatherHusbandName: "ପ୍ରତିମା ଚନ୍ଦ୍ର ବଡ଼ଯେନା",
            surveyNo: "309",
            area: 10.5,
            landClass: "ଦଣ୍ଡା",
          },
        ],
      },
    },
    expected: {
      nameMatch: "partial",
      confidenceMin: 0.3,
      confidenceMax: 0.8,
    },
  },
  {
    description: "Multi-tenant — find Krushnachandra among 5 tenants",
    input: {
      claimedOwnerName: "Krushnachandra Barajena",
      rorDocument: {
        khatiyanNo: "830",
        village: "Mendhasala",
        tenants: [
          { tenantName: "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା", fatherHusbandName: "ପ୍ରତିମା ଚନ୍ଦ୍ର ବଡ଼ଯେନା", surveyNo: "309", area: 10.5, landClass: "ଦଣ୍ଡା" },
          { tenantName: "ପ୍ରତିମା ଚନ୍ଦ୍ର ବଡ଼ଯେନା", surveyNo: "309", area: 10.5, landClass: "ଦଣ୍ଡା" },
          { tenantName: "ସୁବ୍ର ଚନ୍ଦ୍ର ବଡ଼ଯେନା", surveyNo: "309", area: 10.5, landClass: "ଦଣ୍ଡା" },
          { tenantName: "ଗୌର ଚନ୍ଦ୍ର ବଡ଼ଯେନା", surveyNo: "309", area: 10.5, landClass: "ଦଣ୍ଡା" },
          { tenantName: "ସୁନୀତା ଦେବୀ", surveyNo: "309", area: 10.5, landClass: "ଦଣ୍ଡା" },
        ],
      },
    },
    expected: {
      nameMatch: "exact",
      confidenceMin: 0.85,
      confidenceMax: 1.0,
    },
  },
  {
    description: "Both names already in Latin — no transliteration needed",
    input: {
      claimedOwnerName: "Krushnachandra Barajena",
      rorDocument: {
        khatiyanNo: "830",
        village: "Mendhasala",
        tenants: [
          { tenantName: "Krushnachandra Barajena", fatherHusbandName: "Pratima Chandra Barajena", surveyNo: "309", area: 10.5, landClass: "irrigated" },
        ],
      },
    },
    expected: {
      nameMatch: "exact",
      confidenceMin: 0.90,
      confidenceMax: 1.0,
    },
  },
  {
    description: "Surname cluster — Baral vs Barajena",
    input: {
      claimedOwnerName: "Baral",
      rorDocument: {
        khatiyanNo: "830",
        village: "Mendhasala",
        tenants: [
          { tenantName: "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା", surveyNo: "309", area: 10.5, landClass: "ଦଣ୍ଡା" },
        ],
      },
    },
    expected: {
      nameMatch: "partial",
      confidenceMin: 0.45,
      confidenceMax: 0.70,
    },
  },
  {
    description: "No tenants — unknown",
    input: {
      claimedOwnerName: "Mohapatra",
      rorDocument: {
        khatiyanNo: "830",
        village: "Mendhasala",
        tenants: [],
      },
    },
    expected: {
      nameMatch: "unknown",
      confidenceMin: 0,
      confidenceMax: 0,
    },
  },
];
