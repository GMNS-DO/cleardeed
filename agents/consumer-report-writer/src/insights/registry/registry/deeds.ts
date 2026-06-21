// agents/consumer-report-writer/src/insights/registry/registry/deeds.ts
import type { Rule, RuleInput } from "../../schema";
import { liveDataPresent, stubFor } from "../_shared";

const v = "1.0.0";

// HIGH #4: gate every stub on RoR data presence so demos / partial
// fetches without RoR don't accumulate ~20 "Manual verification"
// watchouts.
function deedsSellerMatchesRorStub(input: RuleInput) {
  if (!liveDataPresent(input, "ror")) return null;
  return [
    stubFor(
      "ROR-INS-110",
      "deeds",
      "title_chain",
      "parser_uncertain",
      "Seller-vs-RoR owner comparison is not yet checked. Will activate once the IGR sale-deed bridge ships.",
      "Ask the seller for the last registered sale deed and compare the seller name with the RoR owner name (and guardian/father field) before signing.",
      "IGR sale-deed not wired — ask for the last sale deed"
    ),
  ];
}

function deedsSellerMismatchesRorStub(input: RuleInput) {
  if (!liveDataPresent(input, "ror")) return null;
  return [
    stubFor(
      "ROR-INS-111",
      "deeds",
      "title_chain",
      "parser_uncertain",
      "Seller-vs-RoR owner mismatch is not yet checked. Will activate once the IGR sale-deed bridge ships.",
      "If the seller name does not match the RoR owner, demand a registered Power of Attorney (PoA) or chain of inheritance deeds linking them.",
      "IGR sale-deed not wired — demand a registered PoA"
    ),
  ];
}

function deedsBelowBenchmarkStub(input: RuleInput) {
  if (!liveDataPresent(input, "ror")) return null;
  return [
    stubFor(
      "ROR-INS-112",
      "deeds",
      "registry_ec",
      "parser_uncertain",
      "Last-deed value vs IGR benchmark is not yet checked. Will activate once the IGR sale-deed bridge ships and IGR benchmark coverage lands.",
      "Compare the consideration value in the last sale deed with the IGR circle-rate benchmark for the village. A deal priced far below benchmark is a watch-out — ask the seller why.",
      "IGR benchmark not wired — compare consideration with circle rate"
    ),
  ];
}

function deedsNoSaleDeedStub(input: RuleInput) {
  if (!liveDataPresent(input, "ror")) return null;
  return [
    stubFor(
      "ROR-INS-113",
      "deeds",
      "title_chain",
      "parser_uncertain",
      "Sale-deed retrievability check is not yet wired. Will activate once the IGR sale-deed bridge ships.",
      "If no sale deed is retrievable for the period, the chain of title is incomplete — request certified copies from the Sub-Registrar office where the deed was registered.",
      "IGR sale-deed not wired — get certified copies from SRO"
    ),
  ];
}

function deedsPartitionUntracedStub(input: RuleInput) {
  if (!liveDataPresent(input, "ror")) return null;
  return [
    stubFor(
      "ROR-INS-114",
      "deeds",
      "title_chain",
      "parser_uncertain",
      "Partition-with-untraced-branch check is not yet wired. Will activate once the IGR sale-deed bridge ships.",
      "If the RoR shows a partition, ask the seller for the partition deed and confirm that all coparceners signed. An untraced branch is a title defect.",
      "IGR sale-deed not wired — ask for the partition deed"
    ),
  ];
}

export const deedsRules: Rule[] = [
  { id: "ROR-INS-110", panel: "deeds", fn: deedsSellerMatchesRorStub, version: v },
  { id: "ROR-INS-111", panel: "deeds", fn: deedsSellerMismatchesRorStub, version: v },
  { id: "ROR-INS-112", panel: "deeds", fn: deedsBelowBenchmarkStub, version: v },
  { id: "ROR-INS-113", panel: "deeds", fn: deedsNoSaleDeedStub, version: v },
  { id: "ROR-INS-114", panel: "deeds", fn: deedsPartitionUntracedStub, version: v },
];
