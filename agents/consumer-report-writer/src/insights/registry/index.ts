// agents/consumer-report-writer/src/insights/registry/index.ts
import type { Rule } from "../schema";

import { bhulekhPlotRules } from "./bhulekh/plot";
import { bhulekhOwnerRules } from "./bhulekh/owner";
import { bhulekhLandRules } from "./bhulekh/land";
import { bhulekhPlotTableRules } from "./bhulekh/plot-table";
import { bhulekhDuesRules } from "./bhulekh/dues";
import { bhulekhBackPageRules } from "./bhulekh/back-page";

import { bhunakshaPlotRules } from "./bhunaksha/plot";
import { bhunakshaRoadAccessRules } from "./bhunaksha/road-access";
import { bhunakshaNeighboursRules } from "./bhunaksha/neighbours";

import { encumbranceRules } from "./registry/encumbrance";
import { deedsRules } from "./registry/deeds";
import { courtRules } from "./registry/court";
import { financialRules } from "./registry/financial";
import { completenessRules } from "./registry/completeness";

import { chainRecursiveRules } from "./recursive/chain-recursive";
import { neighboursRecursiveRules } from "./recursive/neighbours-recursive";
import { zoningRules } from "./recursive/zoning";

export const ALL_RULES: Rule[] = [
  ...bhulekhPlotRules,
  ...bhulekhOwnerRules,
  ...bhulekhLandRules,
  ...bhulekhPlotTableRules,
  ...bhulekhDuesRules,
  ...bhulekhBackPageRules,
  ...bhunakshaPlotRules,
  ...bhunakshaRoadAccessRules,
  ...bhunakshaNeighboursRules,
  ...encumbranceRules,
  ...deedsRules,
  ...courtRules,
  ...financialRules,
  ...completenessRules,
  ...chainRecursiveRules,
  ...neighboursRecursiveRules,
  ...zoningRules,
];
