// agents/consumer-report-writer/src/insights/registry/recursive/neighbours-recursive.ts
import type { Rule } from "../../schema";
import { stubFor } from "../_shared";

const v = "1.0.0";

const neighboursRecursive: Rule = {
  id: "ROR-INS-151",
  panel: "neighbours",
  fn: () => [
    stubFor(
      "ROR-INS-151",
      "neighbours",
      "land_use_permission",
      "parser_uncertain",
      "Adjacent-plot recursive lookup is not yet wired. Will activate once Bhulekh batched query lands (UP-006).",
      "Manually check the Bhulekh entries for plots on all four sides of the queried plot."
    ),
  ],
  version: v,
};

export const neighboursRecursiveRules: Rule[] = [neighboursRecursive];
