/**
 * P3 V1 — 6 golden chain fixtures.
 *
 * Plan §4.6 + §4.7: 6 cases covering:
 *   1. single transfer
 *   2. partition
 *   3. mortgage-no-release
 *   4. rapid-flips
 *   5. inheritance-unrecorded
 *   6. partition-missing-shares
 *
 * Each fixture has:
 *   - input: A13Input
 *   - expected: { eventCount, ownerCount, flagCount, flagCode? }
 *
 * The fixtures are used by the test suite to assert the agent
 * produces the right structure and flags.
 */

import type { A13Input } from "../src/schema";

export interface GoldenChainExpected {
  /** Number of events in the result (mutation + encumbrance) */
  eventCount: number;
  /** Number of unique owners (nodes) */
  ownerCount: number;
  /** Number of red flags raised */
  flagCount: number;
  /** Specific flag code that should be present (if any) */
  flagCode?: string;
  /** Expected summary (the count-only string) */
  summary: string;
}

export interface GoldenChain {
  name: string;
  description: string;
  input: A13Input;
  expected: GoldenChainExpected;
}

export const SINGLE_TRANSFER: GoldenChain = {
  name: "single-transfer",
  description: "A plot with a single sale — no flags expected.",
  input: {
    plotNo: "415",
    mutationHistory: [
      {
        mutationNumber: "MUT-1",
        mutationDate: "2010-06-15",
        plotNo: "415",
        fromKhatiyan: "90",
        toKhatiyan: "94",
        parties: [
          { name: "Ramesh Mohapatra", role: "from/seller" },
          { name: "Suresh Mohapatra", role: "to/buyer" },
        ],
        docType: "sale-deed",
        rawText: "Sale deed from Ramesh to Suresh on plot 415",
      },
    ],
    encumbranceEntries: [],
    tenants: [
      { tenantName: "Suresh Mohapatra", fatherHusbandName: "Ramesh Mohapatra" },
    ],
    viewport: "unknown",
  },
  expected: {
    eventCount: 1,
    ownerCount: 2, // Ramesh + Suresh
    flagCount: 0,
    summary: "1 event, 2 owners",
  },
};

export const PARTITION: GoldenChain = {
  name: "partition",
  description: "A plot with a clean partition — co-sharers are all listed, so PARTITION_MISSING_SHARES does not trigger.",
  input: {
    plotNo: "415",
    mutationHistory: [
      {
        mutationNumber: "MUT-1",
        mutationDate: "2005-03-20",
        plotNo: "415",
        parties: [
          { name: "Harihar Panda", role: "from" },
          { name: "Bharat Panda", role: "co-sharer" },
          { name: "Chakra Panda", role: "co-sharer" },
        ],
        docType: "sale",
        rawText: "Sale post-partition with all co-sharers recorded",
      },
    ],
    encumbranceEntries: [],
    tenants: [{ tenantName: "Harihar Panda" }],
    viewport: "unknown",
  },
  expected: {
    eventCount: 1,
    ownerCount: 3, // Harihar + Bharat + Chakra
    flagCount: 0,
    summary: "1 event, 3 owners",
  },
};

export const MORTGAGE_NO_RELEASE: GoldenChain = {
  name: "mortgage-no-release",
  description: "Plan §4.3 example: a 2010 mortgage with no release — MORTGAGE_NO_RELEASE critical flag expected.",
  input: {
    plotNo: "415",
    mutationHistory: [],
    encumbranceEntries: [
      {
        type: "Mortgage",
        partyName: "Sample Bank",
        docNo: "DOC-9",
        date: "2010-02-02",
        amount: "100000",
        description: "Mortgage with Sample Bank dated 2010-02-02 for 100000",
      },
    ],
    tenants: [{ tenantName: "Ananta Mohapatra" }],
    viewport: "unknown",
  },
  expected: {
    eventCount: 1,
    ownerCount: 2, // Sample Bank (mortgagee) + tenant
    flagCount: 1,
    flagCode: "MORTGAGE_NO_RELEASE",
    summary: "1 event, 2 owners, 1 critical flag",
  },
};

export const RAPID_FLIPS: GoldenChain = {
  name: "rapid-flips",
  description: "Three sales in quick succession — RAPID_FLIPS warn flag expected.",
  input: {
    plotNo: "415",
    mutationHistory: [
      {
        mutationNumber: "MUT-1",
        mutationDate: "2015-04-10",
        plotNo: "415",
        parties: [
          { name: "Owner A", role: "from" },
          { name: "Owner B", role: "to" },
        ],
        docType: "sale",
        rawText: "Sale from Owner A to Owner B",
      },
      {
        mutationNumber: "MUT-2",
        mutationDate: "2017-09-22",
        plotNo: "415",
        parties: [
          { name: "Owner B", role: "from" },
          { name: "Owner C", role: "to" },
        ],
        docType: "sale",
        rawText: "Sale from Owner B to Owner C",
      },
      {
        mutationNumber: "MUT-3",
        mutationDate: "2020-01-15",
        plotNo: "415",
        parties: [
          { name: "Owner C", role: "from" },
          { name: "Owner D", role: "to" },
        ],
        docType: "sale",
        rawText: "Sale from Owner C to Owner D",
      },
    ],
    encumbranceEntries: [],
    tenants: [{ tenantName: "Owner D" }],
    viewport: "unknown",
  },
  expected: {
    eventCount: 3,
    ownerCount: 4, // A, B, C, D
    flagCount: 1,
    flagCode: "RAPID_FLIPS",
    summary: "3 events, 4 owners, 1 warn flag",
  },
};

export const INHERITANCE_UNRECORDED: GoldenChain = {
  name: "inheritance-unrecorded",
  description: "An inheritance event — INHERITANCE_UNRECORDED warn flag expected.",
  input: {
    plotNo: "415",
    mutationHistory: [
      {
        mutationNumber: "MUT-1",
        mutationDate: "2012-07-01",
        plotNo: "415",
        parties: [
          { name: "Bhagirathi Nayak", role: "deceased" },
          { name: "Prakash Nayak", role: "heir" },
        ],
        docType: "inheritance",
        rawText: "Inheritance succession from Bhagirathi to Prakash",
      },
    ],
    encumbranceEntries: [],
    tenants: [{ tenantName: "Prakash Nayak" }],
    viewport: "unknown",
  },
  expected: {
    eventCount: 1,
    ownerCount: 2, // Bhagirathi + Prakash
    flagCount: 1,
    flagCode: "INHERITANCE_UNRECORDED",
    summary: "1 event, 2 owners, 1 warn flag",
  },
};

export const PARTITION_MISSING_SHARES: GoldenChain = {
  name: "partition-missing-shares",
  description: "A partition event — PARTITION_MISSING_SHARES warn flag expected.",
  input: {
    plotNo: "415",
    mutationHistory: [
      {
        mutationNumber: "MUT-1",
        mutationDate: "2018-05-10",
        plotNo: "415",
        parties: [
          { name: "Joint Family", role: "from" },
        ],
        docType: "partition",
        rawText: "Partition of joint family land",
      },
    ],
    encumbranceEntries: [],
    tenants: [{ tenantName: "Joint Family" }],
    viewport: "unknown",
  },
  expected: {
    eventCount: 1,
    ownerCount: 1,
    flagCount: 1,
    flagCode: "PARTITION_MISSING_SHARES",
    summary: "1 event, 1 owner, 1 warn flag",
  },
};

export const ALL_GOLDEN_CHAINS: GoldenChain[] = [
  SINGLE_TRANSFER,
  PARTITION,
  MORTGAGE_NO_RELEASE,
  RAPID_FLIPS,
  INHERITANCE_UNRECORDED,
  PARTITION_MISSING_SHARES,
];
