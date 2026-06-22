// agents/consumer-report-writer/src/insights/registry/recursive/zoning.ts
//
// T-052 (ROR-INS-152 — BDA layout approval sub-plot detector) was
// moved to ./bhulekh/bda-layout.ts. ROR-INS-152 now fires a real
// redFlag (not a stub) when the RoR plot number carries a sub-plot
// indicator. The BDA zone check (ROR-INS-153) remains a stub until
// T-052/T-065 ship the BDA Master Plan overlay.

import type { Rule } from "../../schema";
import { stubFor } from "../_shared";

const v = "1.0.0";

const bdaZone: Rule = {
  id: "ROR-INS-153",
  panel: "land",
  fn: () => [
    stubFor(
      "ROR-INS-153",
      "land",
      "land_use_permission",
      "parser_uncertain",
      "BDA Master Plan zone check is not yet wired. Will activate once BDA overlay ships (T-052/T-065).",
      "Verify the plot's BDA Master Plan zone manually at bda.gov.in or via the Bhubaneswar town planning office.",
      "BDA zone not checked — verify at town planning office"
    ),
  ],
  version: v,
};

export const zoningRules: Rule[] = [bdaZone];
