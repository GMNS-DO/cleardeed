// apps/web/src/lib/pipeline/cross-source-validators.ts
// V1.2 (B11) — Cross-source validators.
//
// Three pipeline-level checks that combine data from multiple sources:
//   1) deed-mismatch: Bhulekh mutation year vs IGR EC deed-year gap
//   2) benchmark-deviation: IGR BMV floor vs Bhunaksha area × circle rate
//   3) revenue-dues: bhulekh mutationReferences with pending revenue case markers
//
// Returns findings for renderer consumption via reportInput.legalWarnings.

export interface CrossSourceValidatorInput {
  bhulekhData?: {
    mutationYear?: number | null;
    mutationReferences?: Array<{ reference?: string; pending?: boolean | string }>;
  } | null;
  igrEcResult?: { data?: { deeds?: Array<{ year?: number }> } } | null;
  igrBmvResult?: {
    data?: { bmvFloorPerSqft?: number; bmvApplied?: boolean };
  } | null;
  stampDutyResult?: { data?: { bmvFloorApplied?: boolean } } | null;
  circleRateResult?: { data?: { circleRatePerSqft?: number } } | null;
  bhunakshaResult?: { data?: { area?: number; areaUnit?: string } } | null;
}

export interface LegalWarning {
  code: string;
  severity: "info" | "watchout" | "redFlag";
  title: string;
  detail: string;
  action: string;
}

export function runCrossSourceValidators(input: CrossSourceValidatorInput): LegalWarning[] {
  const findings: LegalWarning[] = [];

  // 1) deed-mismatch: Bhulekh mutation year vs IGR EC latest deed year.
  const bhulekhYear =
    typeof input.bhulekhData?.mutationYear === "number" ? input.bhulekhData.mutationYear : null;
  const igrDeeds = Array.isArray(input.igrEcResult?.data?.deeds)
    ? input.igrEcResult.data.deeds
    : [];
  const latestIgrYear = igrDeeds
    .filter((d) => typeof d.year === "number")
    .map((d) => d.year as number)
    .sort((a, b) => b - a)?.[0];
  if (bhulekhYear && latestIgrYear && bhulekhYear !== latestIgrYear) {
    findings.push({
      code: "deed_mismatch",
      severity: "watchout",
      title: "RoR mutation year differs from IGR EC latest deed year",
      detail: `Bhulekh records mutation in ${bhulekhYear}, but the latest IGR EC deed is dated ${latestIgrYear}. This gap may indicate an unrecorded intermediate transaction or a clerical error.`,
      action: `Ask the seller to produce all intermediate sale deeds between ${bhulekhYear} and ${latestIgrYear}.`,
    });
  }

  // 2) benchmark-deviation: IGR BMV floor vs circle rate.
  const bmvFloor = input.igrBmvResult?.data?.bmvFloorPerSqft;
  const bmvApplied = input.igrBmvResult?.data?.bmvApplied ?? false;
  const circleRate = input.circleRateResult?.data?.circleRatePerSqft;
  const bhunakshaArea = input.bhunakshaResult?.data?.area;
  if (bmvApplied && bmvFloor && circleRate && bhunakshaArea && bhunakshaArea > 0) {
    const expectedBenchmark = circleRate;
    const deviation = ((bmvFloor - expectedBenchmark) / Math.max(expectedBenchmark, 1)) * 100;
    if (deviation > 20) {
      findings.push({
        code: "benchmark_deviation",
        severity: "watchout",
        title: `IGR BMV floor is ${deviation.toFixed(0)}% above circle rate`,
        detail: `The IGR BMV floor (Rs ${bmvFloor}/sqft) is ${deviation.toFixed(0)}% above the circle rate (Rs ${circleRate}/sqft). The government may have bumped the market value based on a transaction with undeclared premium.`,
        action: "Verify the stamp duty paid on the seller's deed. If the declared consideration was below BMV floor, the difference attracts penalty under Section 47A.",
      });
    }
  }

  // 3) revenue-dues: bhulekh mutationReferences with pending revenue case markers.
  const mutationRefs = Array.isArray(input.bhulekhData?.mutationReferences)
    ? input.bhulekhData.mutationReferences
    : [];
  const pendingRefs = mutationRefs.filter(
    (r) => r.pending === true || r.pending === "true" || r.pending === "yes"
  );
  if (pendingRefs.length > 0) {
    findings.push({
      code: "revenue_dues_pending",
      severity: "redFlag",
      title: `${pendingRefs.length} mutation reference(s) marked pending`,
      detail: `The RoR carries ${pendingRefs.length} mutation reference(s) with pending markers: ${pendingRefs
        .map((r) => r.reference ?? "(unknown)")
        .join(", ")}. Pending mutations may indicate unpaid mutation fees or unsettled revenue dues.`,
      action: "Visit the tehsil office and confirm all mutations are up-to-date before proceeding. Unpaid mutation fees attract penalty interest under Section 47A.",
    });
  }

  return findings;
}
