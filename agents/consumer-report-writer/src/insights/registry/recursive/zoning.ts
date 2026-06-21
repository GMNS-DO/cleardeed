// agents/consumer-report-writer/src/insights/registry/recursive/zoning.ts
import type { Rule } from "../../schema";
import { stubFor } from "../_shared";

const v = "1.0.0";

const reraZone: Rule = {
  id: "ROR-INS-152",
  panel: "land",
  fn: () => [
    stubFor(
      "ROR-INS-152",
      "land",
      "land_use_permission",
      "parser_uncertain",
      "RERA / BDA zone cross-check is not yet wired. Will activate once BDA layout checker ships (T-052).",
      "Ask the seller for the BDA layout approval number, and verify at bda.gov.in.",
      "BDA layout check not wired — ask seller for the approval number"
    ),
  ],
  version: v,
};

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

export const zoningRules: Rule[] = [reraZone, bdaZone];
