// agents/consumer-report-writer/src/insights/registry/index.ts
import type { Rule } from "../schema";

import { bhulekhPlotRules } from "./bhulekh/plot";
import { bhulekhOwnerRules } from "./bhulekh/owner";
import { bhulekhLandRules } from "./bhulekh/land";
import { bhulekhLandMiscRules } from "./bhulekh/land-misc";
import { bhulekhChainRules } from "./bhulekh/chain";
import { bhulekhPlotTableRules } from "./bhulekh/plot-table";
import { bhulekhDuesRules } from "./bhulekh/dues";
import { bhulekhBackPageRules } from "./bhulekh/back-page";
import { bhulekhBackPageRecencyRules } from "./bhulekh/back-page-recency";

import { bhunakshaPlotRules } from "./bhunaksha/plot";
import { bhunakshaRoadAccessRules } from "./bhunaksha/road-access";
import { bhunakshaNeighboursRules } from "./bhunaksha/neighbours";

import { encumbranceRules } from "./registry/encumbrance";
import { deedsRules } from "./registry/deeds";
import { courtRules } from "./registry/court";
import { financialRules } from "./registry/financial";
import { completenessRules, plotDiagramRule } from "./registry/completeness";
import { eowRules } from "./eow/blacklist";
// T-041 — Bhuvan flood hazard WMS (planning-only license).
import { bhuvanFloodRules } from "./bhuvan-flood/flood";

import { chainRecursiveRules } from "./recursive/chain-recursive";
import { neighboursRecursiveRules } from "./recursive/neighbours-recursive";
import { zoningRules } from "./recursive/zoning";
import { areaCrossRules } from "./recursive/area-cross";

export const ALL_RULES: Rule[] = [
  ...bhulekhPlotRules,
  ...bhulekhOwnerRules,
  ...bhulekhLandRules,
  ...bhulekhLandMiscRules,
  ...bhulekhChainRules,
  ...bhulekhPlotTableRules,
  ...bhulekhDuesRules,
  ...bhulekhBackPageRules,
  ...bhulekhBackPageRecencyRules,
  ...bhunakshaPlotRules,
  ...bhunakshaRoadAccessRules,
  ...bhunakshaNeighboursRules,
  ...encumbranceRules,
  ...deedsRules,
  ...courtRules,
  ...financialRules,
  ...completenessRules,
  plotDiagramRule,
  ...bhuvanFloodRules,
  ...chainRecursiveRules,
  ...neighboursRecursiveRules,
  ...zoningRules,
  ...areaCrossRules,
  ...eowRules,
];
