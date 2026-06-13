function clean(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function eventDate(event) {
  return event?.event_date || event?.registration_date || event?.execution_date || event?.document_date || null;
}

function sourceRecord(event) {
  return event?.metadata?.source_record || {};
}

function fileRefsFromRecord(record) {
  return [
    ["sale_deed", "saleDeedId", record.saleDeedId],
    ["poa_gpa", "poaId", record.poaId],
    ["encumbrance_certificate", "plotEcId", record.plotEcId],
    ["ror", "plotRorId", record.plotRorId],
    ["sharing_allocation", "shareAllocId", record.shareAllocId],
  ].filter(([, , fileId]) => fileId !== undefined && fileId !== null);
}

function artifactMatchesFile(artifact, field, fileId) {
  const ref = artifact.query?.file_reference || {};
  return ref.field === field && String(ref.fileId || "") === String(fileId || "");
}

function artifactRefs(artifacts, field, fileId) {
  return artifacts
    .filter((artifact) => artifactMatchesFile(artifact, field, fileId))
    .map((artifact) => ({
      artifact_id: artifact.id,
      artifact_type: artifact.artifact_type,
      storage_path: artifact.storage_path,
      source_url: artifact.source_url || null,
      sha256: artifact.sha256 || null,
    }));
}

function factValue(fact) {
  return fact.normalized_value ?? fact.raw_value ?? null;
}

function factsForArtifacts(facts, artifactIds) {
  const ids = new Set(artifactIds);
  return facts
    .filter((fact) => ids.has(fact.artifact_id))
    .map((fact) => ({
      fact_id: fact.id,
      artifact_id: fact.artifact_id,
      predicate: fact.predicate,
      value: factValue(fact),
      review_status: fact.review_status || null,
      confidence: fact.confidence ?? null,
    }));
}

function valuesByPredicate(facts, predicate) {
  return unique(facts.filter((fact) => fact.predicate === predicate).map((fact) => fact.value));
}

function hasPredicateValue(facts, predicate, value = "true") {
  return facts.some((fact) => fact.predicate === predicate && String(fact.value) === value);
}

function propertySummary(property) {
  if (!property) return null;
  return {
    property_id: property.id,
    district: property.district || null,
    tahasil: property.tahasil || null,
    village: property.village || property.mouza || null,
    khata_number: property.khata_number || null,
    plot_number: property.plot_number || null,
    area_value: property.area_value ?? null,
    area_unit: property.area_unit || null,
    canonical_key: property.canonical_key || null,
  };
}

function groupKeyFor(candidate, records) {
  const first = records[0] || {};
  return [
    candidate.pattern_family || "pattern",
    clean(first.saleDeedRegnNo) || clean(candidate.metadata?.sale_deed_number) || "unknown-sale",
    clean(first.saleDeedRegnDate) || clean(candidate.metadata?.sale_date) || "unknown-date",
    clean(first.poaRegnNo) || "no-poa-ref",
  ].join(":").toLowerCase();
}

function chronologyForGroup(group, context) {
  const facts = group.file_refs.flatMap((file) => file.facts);
  const saleNumbers = unique(group.records.map((record) => record.saleDeedRegnNo));
  const saleDates = unique(group.records.map((record) => record.saleDeedRegnDate).concat(group.events.map(eventDate)));
  const poaDates = unique(group.records.map((record) => record.poaRegnDate));
  const entries = [
    {
      stage: "title_flow_sale_reference",
      date: saleDates[0] || null,
      document_number: saleNumbers[0] || null,
      summary: "ORERA title-flow says the property was sold by the stated seller for self and as PoA holder.",
      evidence: unique(group.events.map((event) => event.id)),
      facts: [],
    },
  ];

  const saleOcrFacts = facts.filter((fact) => fact.predicate.startsWith("ocr_sale_deed_")
    || (fact.predicate === "ocr_document_type" && fact.value === "registered_sale_deed_copy"));
  if (saleOcrFacts.length) {
    entries.push({
      stage: "sale_deed_ocr",
      date: valuesByPredicate(facts, "ocr_sale_deed_registration_date")[0] || valuesByPredicate(facts, "ocr_sale_deed_execution_date")[0] || saleDates[0] || null,
      document_number: valuesByPredicate(facts, "ocr_sale_deed_registration_number")[0] || saleNumbers[0] || null,
      summary: "Downloaded sale deed OCR confirms the sale-deed artifact and party context, subject to review.",
      evidence: saleOcrFacts.map((fact) => fact.fact_id),
      facts: saleOcrFacts,
    });
  }

  const poaOcrFacts = facts.filter((fact) => fact.predicate.startsWith("ocr_poa_")
    || fact.predicate === "ocr_power_of_attorney_phrase_observed"
    || (fact.predicate === "ocr_document_type" && fact.value === "general_power_of_attorney"));
  if (poaOcrFacts.length || poaDates.length) {
    entries.push({
      stage: "observed_later_gpa",
      date: valuesByPredicate(facts, "ocr_poa_execution_date")[0] || poaDates[0] || null,
      document_number: unique(group.records.map((record) => record.poaRegnNo))[0] || null,
      summary: "Observed GPA is later than the 2011 sale and appears to support development/project authority, not historical sale authority.",
      evidence: poaOcrFacts.map((fact) => fact.fact_id),
      facts: poaOcrFacts,
    });
  }

  const sharingFacts = facts.filter((fact) => fact.predicate.startsWith("ocr_sharing_agreement_"));
  if (sharingFacts.length) {
    entries.push({
      stage: "sharing_allocation_ocr",
      date: valuesByPredicate(facts, "ocr_sharing_agreement_execution_date")[0] || null,
      document_number: null,
      summary: "Sharing/allocation OCR provides later owner/project allocation context, not historical pre-sale authority.",
      evidence: sharingFacts.map((fact) => fact.fact_id),
      facts: sharingFacts,
    });
  }

  const ecFacts = facts.filter((fact) => fact.predicate.startsWith("ocr_ec_"));
  if (ecFacts.length) {
    entries.push({
      stage: "encumbrance_certificate_ocr",
      date: valuesByPredicate(facts, "ocr_ec_search_period_end")[0] || null,
      document_number: valuesByPredicate(facts, "ocr_ec_certificate_number")[0] || null,
      summary: "EC OCR evidence is period-scoped and must not be treated as a complete title clearance.",
      evidence: ecFacts.map((fact) => fact.fact_id),
      facts: ecFacts,
    });
  }

  const rorFacts = facts.filter((fact) => fact.predicate.startsWith("ocr_ror_"));
  if (rorFacts.length) {
    entries.push({
      stage: "ror_ocr",
      date: null,
      document_number: null,
      summary: "RoR OCR hints are available but remain lead-only until reviewed.",
      evidence: rorFacts.map((fact) => fact.fact_id),
      facts: rorFacts,
    });
  }

  return entries.sort((a, b) => String(a.date || "9999").localeCompare(String(b.date || "9999")));
}

function groupToPacket(group, context) {
  const allFileRefsCollected = group.file_refs.every((file) => file.collected);
  const saleDate = unique(group.records.map((record) => record.saleDeedRegnDate).concat(group.events.map(eventDate)))[0];
  const poaDates = unique(group.records.map((record) => record.poaRegnDate));
  const postSalePoaObserved = saleDate && poaDates.some((date) => new Date(date) > new Date(saleDate));
  const facts = group.file_refs.flatMap((file) => file.facts);
  const historicalAuthoritySignals = facts.filter((fact) => {
    const value = String(fact.value || "");
    return /authority|power of attorney|gpa|poa/i.test(value)
      && saleDate
      && /\b20(0\d|10|11)\b/.test(value);
  });
  const blockers = [
    !allFileRefsCollected ? "known_file_ids_not_fully_collected" : null,
    postSalePoaObserved ? "only_later_poa_reference_observed" : null,
    historicalAuthoritySignals.length === 0 ? "no_pre_sale_authority_signal_observed" : null,
    "requires_human_title_chain_review",
  ].filter(Boolean);

  return {
    packet_key: group.group_key,
    packet_type: "orera_title_chain_review",
    project: {
      project_id: unique(group.records.map((record) => record.projectId))[0] || null,
      project_name: valuesByPredicate(facts, "ocr_poa_project_name")[0] || null,
      source_id: "orera_rera",
    },
    candidates: group.candidates.map((candidate) => ({
      candidate_id: candidate.id,
      candidate_key: candidate.candidate_key,
      status: candidate.status,
      latest_review_status: candidate.metadata?.last_review_status || null,
    })),
    properties: group.properties.map(propertySummary).filter(Boolean),
    sale_reference: {
      registration_numbers: unique(group.records.map((record) => record.saleDeedRegnNo)),
      registration_dates: unique(group.records.map((record) => record.saleDeedRegnDate)),
      sros: unique(group.records.map((record) => record.saleDeedRegnAt)),
      ocr_first_parties: valuesByPredicate(facts, "ocr_sale_deed_first_party_name"),
      ocr_second_parties: valuesByPredicate(facts, "ocr_sale_deed_second_party_name"),
      property_references_from_ocr: valuesByPredicate(facts, "ocr_sale_deed_property_reference"),
      identifier_names_from_ocr: valuesByPredicate(facts, "ocr_sale_deed_identifier_name"),
      buyer_title_verification_declaration_observed: hasPredicateValue(facts, "ocr_sale_deed_buyer_title_verification_declaration"),
      vendor_vendee_execution_declaration_observed: hasPredicateValue(facts, "ocr_sale_deed_vendor_vendee_execution_declaration"),
      authority_reference_observed_from_ocr: valuesByPredicate(facts, "ocr_sale_deed_authority_reference_observed"),
      historical_authority_reference_not_observed_from_ocr: hasPredicateValue(facts, "ocr_sale_deed_historical_authority_reference_not_observed"),
    },
    observed_poa_reference: {
      registration_numbers: unique(group.records.map((record) => record.poaRegnNo)),
      registration_dates: unique(group.records.map((record) => record.poaRegnDate)),
      execution_dates_from_ocr: valuesByPredicate(facts, "ocr_poa_execution_date"),
      principals_from_ocr: valuesByPredicate(facts, "ocr_poa_principal_name"),
      attorney_entities_from_ocr: valuesByPredicate(facts, "ocr_poa_attorney_entity"),
      prior_document_references_from_ocr: valuesByPredicate(facts, "ocr_poa_prior_document_reference"),
      post_sale_poa_observed: Boolean(postSalePoaObserved),
    },
    file_refs: group.file_refs,
    chronology: chronologyForGroup(group, context),
    blockers: unique(blockers),
    review_posture: blockers.length ? "lead_only_needs_followup" : "ready_for_review",
    conclusion: blockers.includes("no_pre_sale_authority_signal_observed")
      ? "Known ORERA attachments are collected, but the packet still lacks observed pre-sale authority proof for the 2011 seller-agent. Sale-deed OCR did not surface a historical authority reference."
      : "Known ORERA attachments are collected and the packet has potential historical authority signals requiring review.",
    next_evidence: unique([
      "Find or manually intake the historical pre-sale PoA/GPA/deed authority artifact tied to sale deed 10611104830.",
      "Review the sale deed property schedule and party clauses for a pre-sale authority document number.",
      "Do not promote this as a reusable PoA-risk pattern until the title-chain packet has a reviewed historical authority conclusion.",
    ]),
  };
}

export function buildTitleChainPackets(input) {
  const context = {
    candidates: input.candidates || [],
    events: input.events || [],
    artifacts: input.artifacts || [],
    properties: input.properties || [],
    facts: input.facts || [],
  };
  const eventById = new Map(context.events.map((event) => [event.id, event]));
  const propertyById = new Map(context.properties.map((property) => [property.id, property]));
  const groups = new Map();

  for (const candidate of context.candidates.filter((row) => row.pattern_family === "poa_chain")) {
    const events = (candidate.supporting_event_ids || []).map((id) => eventById.get(id)).filter(Boolean);
    const records = events.map(sourceRecord).filter((record) => Object.keys(record).length);
    const groupKey = groupKeyFor(candidate, records);
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        group_key: groupKey,
        candidates: [],
        events: [],
        records: [],
        properties: [],
        file_refs: [],
      });
    }
    const group = groups.get(groupKey);
    group.candidates.push(candidate);
    group.events.push(...events);
    group.records.push(...records);
    group.properties.push(...events.map((event) => propertyById.get(event.property_id)).filter(Boolean));
  }

  for (const group of groups.values()) {
    const fileRefMap = new Map();
    for (const record of group.records) {
      for (const [role, field, fileId] of fileRefsFromRecord(record)) {
        const key = `${field}:${fileId}`;
        if (!fileRefMap.has(key)) {
          const artifacts = artifactRefs(context.artifacts, field, fileId);
          const artifactIds = artifacts.map((artifact) => artifact.artifact_id);
          fileRefMap.set(key, {
            role,
            field,
            file_id: String(fileId),
            collected: artifacts.length > 0,
            artifacts,
            facts: factsForArtifacts(context.facts, artifactIds),
          });
        }
      }
    }
    group.file_refs = [...fileRefMap.values()];
    group.events = [...new Map(group.events.map((event) => [event.id, event])).values()];
    group.records = [...new Map(group.records.map((record) => [
      `${record.landDetailId || ""}:${record.plotNo || ""}:${record.saleDeedId || ""}`,
      record,
    ])).values()];
    group.properties = [...new Map(group.properties.map((property) => [property.id, property])).values()];
  }

  return [...groups.values()].map((group) => groupToPacket(group, context));
}
