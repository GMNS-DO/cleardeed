// agents/consumer-report-writer/src/insights/registry/recursive/chain-recursive.ts
import type { Rule } from "../../schema";
import { stubFor } from "../_shared";

const v = "1.0.0";

const chainRecursive: Rule = {
  id: "ROR-INS-150",
  panel: "chain",
  fn: () => [
    stubFor(
      "ROR-INS-150",
      "chain",
      "title_chain",
      "parser_uncertain",
      "Title-chain recursion across old/new khatiyans is not yet wired. Will activate once IGR deeds ship (UP-007).",
      "Ask the seller's lawyer for the chain of sale deeds from the last personal RoR owner to today.",
      "IGR deeds not wired — ask for the chain of sale deeds"
    ),
  ],
  version: v,
};

export const chainRecursiveRules: Rule[] = [chainRecursive];
