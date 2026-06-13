function clean(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function dateOf(row) {
  return row?.event_date || row?.registration_date || row?.document_date || null;
}

function signedDaysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return null;
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

function sourceRecord(event) {
  return event?.metadata?.source_record || {};
}

function extractAuthorityParties(titleFlow) {
  const text = String(titleFlow || "").replace(/\s+/g, " ").trim();
  const match = text.match(/executed\s+by\s+(.+?)\s+for\s+self\s+and\s+as\s+(?:a\s+)?poa\s+holder\s+of\s+(.+?)\s+sold\b/i);
  if (!match) {
    return {
      agent: null,
      principals: [],
      authority_phrase_observed: /\bpoa\s+holder\b/i.test(text),
    };
  }
  return {
    agent: clean(match[1]),
    principals: unique(match[2].split(/\s+and\s+|,\s*/i)),
    authority_phrase_observed: true,
  };
}

function documentMatchesRecord(document, record) {
  const metadata = document.metadata || {};
  const docNumber = clean(document.document_number);
  const saleNo = clean(record.saleDeedRegnNo);
  const poaNo = clean(record.poaRegnNo);
  return Boolean(
    (document.document_type === "sale_deed_reference" && saleNo && docNumber === saleNo)
    || (document.document_type === "poa_reference" && poaNo && docNumber === poaNo)
    || (record.saleDeedId && metadata.saleDeedId === record.saleDeedId)
    || (record.poaId && metadata.poaId === record.poaId)
    || (record.landDetailId && metadata.landDetailId === record.landDetailId)
  );
}

function artifactForFileId(artifacts, fileId) {
  if (!fileId) return [];
  const id = String(fileId);
  return artifacts
    .filter((artifact) => String(artifact.query?.file_reference?.fileId || "") === id)
    .map((artifact) => ({
      artifact_id: artifact.id,
      artifact_type: artifact.artifact_type,
      field: artifact.query?.file_reference?.field || null,
      storage_path: artifact.storage_path,
      source_url: artifact.source_url,
      sha256: artifact.sha256 || null,
    }));
}

function artifactAvailability(record, artifacts) {
  const refs = [
    ["saleDeedId", record.saleDeedId],
    ["poaId", record.poaId],
    ["plotEcId", record.plotEcId],
    ["plotRorId", record.plotRorId],
    ["shareAllocId", record.shareAllocId],
  ];
  return refs
    .filter(([, fileId]) => fileId !== undefined && fileId !== null)
    .map(([field, fileId]) => {
      const matches = artifactForFileId(artifacts, fileId);
      return {
        field,
        file_id: String(fileId),
        collected: matches.length > 0,
        artifacts: matches,
      };
    });
}

function ocrFactsForArtifacts(facts, artifactIds) {
  const ids = new Set(artifactIds);
  return facts
    .filter((fact) => ids.has(fact.artifact_id) && String(fact.predicate || "").startsWith("ocr_"))
    .map((fact) => ({
      fact_id: fact.id,
      artifact_id: fact.artifact_id,
      predicate: fact.predicate,
      value: fact.normalized_value ?? fact.raw_value,
      confidence: fact.confidence ?? null,
      review_status: fact.review_status || null,
    }));
}

function valuesByPredicate(facts, predicate) {
  return unique(facts
    .filter((fact) => fact.predicate === predicate)
    .map((fact) => {
      const value = String(fact.value || "");
      if (predicate === "ocr_poa_attorney_entity" && /silkcity realestate/i.test(value)) {
        return "M/s. Silkcity Realestate";
      }
      return value;
    }));
}

function laterPoaReferences(records, saleDate) {
  return records
    .map((record) => {
      const poaDate = clean(record.poaRegnDate);
      const timingDays = saleDate && poaDate ? signedDaysBetween(saleDate, poaDate) : null;
      return {
        poa_registration_number: clean(record.poaRegnNo),
        poa_registration_date: poaDate,
        poa_sro: clean(record.poaRegnAt),
        poa_file_id: record.poaId ? String(record.poaId) : null,
        timing_days_poa_minus_sale: timingDays,
        after_sale: timingDays !== null ? timingDays > 0 : null,
      };
    })
    .filter((row) => row.poa_registration_number || row.poa_registration_date || row.poa_file_id);
}

function buildPacket(candidate, context) {
  const { events, documents, artifacts, properties, reviews, facts } = context;
  const eventById = new Map(events.map((event) => [event.id, event]));
  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const supportingEvents = (candidate.supporting_event_ids || [])
    .map((id) => eventById.get(id))
    .filter(Boolean);
  const records = supportingEvents.map(sourceRecord).filter((record) => Object.keys(record).length);
  const saleEvent = supportingEvents.find((event) => event.event_type === "sale_registered") || supportingEvents[0] || {};
  const saleDate = candidate.metadata?.sale_date || dateOf(saleEvent);
  const titleFlows = records.map((record) => record.titleFlow).filter(Boolean);
  const authorityParties = titleFlows.map(extractAuthorityParties);
  const agentNames = unique(authorityParties.map((item) => item.agent));
  const principalNames = unique(authorityParties.flatMap((item) => item.principals));
  const relatedDocuments = documents.filter((document) => records.some((record) => documentMatchesRecord(document, record)));
  const poaReferences = laterPoaReferences(records, saleDate);
  const laterPoaObserved = poaReferences.some((row) => row.after_sale === true);
  const preSalePoaObserved = poaReferences.some((row) => row.after_sale === false);
  const availability = records.flatMap((record) => artifactAvailability(record, artifacts));
  const saleArtifactIds = availability
    .filter((item) => item.field === "saleDeedId")
    .flatMap((item) => item.artifacts.map((artifact) => artifact.artifact_id));
  const poaArtifactIds = availability
    .filter((item) => item.field === "poaId")
    .flatMap((item) => item.artifacts.map((artifact) => artifact.artifact_id));
  const saleOcrFacts = ocrFactsForArtifacts(facts, saleArtifactIds);
  const poaOcrFacts = ocrFactsForArtifacts(facts, poaArtifactIds);
  const saleOcrExecutionDates = valuesByPredicate(saleOcrFacts, "ocr_sale_deed_execution_date");
  const saleOcrRegistrationDates = valuesByPredicate(saleOcrFacts, "ocr_sale_deed_registration_date");
  const saleOcrFirstParties = valuesByPredicate(saleOcrFacts, "ocr_sale_deed_first_party_name");
  const saleOcrSecondParties = valuesByPredicate(saleOcrFacts, "ocr_sale_deed_second_party_name");
  const poaOcrExecutionDates = valuesByPredicate(poaOcrFacts, "ocr_poa_execution_date");
  const poaOcrPrincipals = valuesByPredicate(poaOcrFacts, "ocr_poa_principal_name");
  const poaOcrAttorneyEntities = valuesByPredicate(poaOcrFacts, "ocr_poa_attorney_entity");
  const poaOcrPriorDocs = valuesByPredicate(poaOcrFacts, "ocr_poa_prior_document_reference");
  const missingArtifacts = availability.filter((item) => !item.collected);
  const latestReview = reviews
    .filter((review) => review.target_type === "pattern_candidate" && review.target_id === candidate.id)
    .sort((a, b) => String(b.reviewed_at).localeCompare(String(a.reviewed_at)))[0] || null;
  const property = propertyById.get(candidate.metadata?.property_id);
  const missingAuthorityTarget = [
    "Historical registered PoA/GPA/deed of authority",
    saleDate ? `executed on or before ${saleDate}` : "executed on or before the sale date",
    agentNames.length ? `authorizing ${agentNames.join(", ")}` : "authorizing the stated seller/agent",
    principalNames.length ? `to act for ${principalNames.join(", ")}` : "to act for the stated principals",
    records[0]?.saleDeedRegnNo ? `for sale deed ${clean(records[0].saleDeedRegnNo)}` : null,
  ].filter(Boolean).join("; ");

  const blockers = [
    "fewer_than_two_evidence_items",
    laterPoaObserved && !preSalePoaObserved
      ? "only_later_poa_reference_observed"
      : "authority_document_not_observed",
  ];
  if (missingArtifacts.some((item) => ["saleDeedId", "poaId"].includes(item.field))) {
    blockers.push("sale_or_authority_artifact_not_collected");
  }

  const ocrPoaAfterSale = poaOcrExecutionDates.some((date) => saleDate && signedDaysBetween(saleDate, date) > 0);
  const saleOrPoaArtifactsMissing = missingArtifacts.some((item) => ["saleDeedId", "poaId"].includes(item.field));
  const nextEvidence = [
    missingAuthorityTarget,
    saleOrPoaArtifactsMissing
      ? "Collect or manually intake the sale deed and historical PoA/GPA/deed authority artifact, then OCR/review the authority chain."
      : "Review the downloaded sale deed and post-sale GPA, then continue searching for the historical pre-sale PoA/GPA/deed authority artifact.",
  ];
  if (laterPoaObserved) {
    nextEvidence.push("Do not use the 2022 PoA reference to support the 2011 sale authority unless a reviewed document proves it is historically relevant.");
  }

  return {
    candidate_id: candidate.id,
    candidate_key: candidate.candidate_key,
    candidate_name: candidate.candidate_name,
    pattern_family: candidate.pattern_family,
    status: candidate.status,
    latest_review_status: latestReview?.review_status || null,
    latest_reviewed_at: latestReview?.reviewed_at || null,
    property: property ? {
      property_id: property.id,
      district: property.district || null,
      village: property.village || property.mouza || null,
      khata_number: property.khata_number || null,
      plot_number: property.plot_number || null,
      area_value: property.area_value ?? null,
      area_unit: property.area_unit || null,
      canonical_key: property.canonical_key || null,
    } : { property_id: candidate.metadata?.property_id || null },
    sale_reference: {
      sale_registration_number: clean(records[0]?.saleDeedRegnNo),
      sale_registration_date: saleDate || null,
      sale_sro: clean(records[0]?.saleDeedRegnAt),
      sale_file_ids: unique(records.map((record) => record.saleDeedId)),
    },
    authority_reference: {
      title_flow_authority_phrase_observed: authorityParties.some((item) => item.authority_phrase_observed),
      agent_names: agentNames,
      principal_names: principalNames,
      later_poa_references: poaReferences,
      pre_sale_poa_reference_observed: preSalePoaObserved,
      missing_authority_target: missingAuthorityTarget,
    },
    related_documents: relatedDocuments.map((document) => ({
      document_id: document.id,
      document_type: document.document_type,
      document_number: clean(document.document_number),
      registration_date: document.registration_date || null,
      sro: document.sro || null,
      artifact_id: document.artifact_id || null,
    })),
    artifact_availability: availability,
    observed_ocr_evidence: {
      sale_artifact_fact_ids: saleOcrFacts.map((fact) => fact.fact_id),
      poa_artifact_fact_ids: poaOcrFacts.map((fact) => fact.fact_id),
      sale_deed_execution_dates: saleOcrExecutionDates,
      sale_deed_registration_dates: saleOcrRegistrationDates,
      sale_deed_first_party_names: saleOcrFirstParties,
      sale_deed_second_party_names: saleOcrSecondParties,
      poa_execution_dates: poaOcrExecutionDates,
      poa_principal_names: poaOcrPrincipals,
      poa_attorney_entities: poaOcrAttorneyEntities,
      poa_prior_document_references: poaOcrPriorDocs,
      poa_ocr_after_sale: ocrPoaAfterSale,
    },
    blockers: unique(blockers),
    blocker_language: ocrPoaAfterSale
      ? "Downloaded/OCRed PoA artifact appears to be a post-sale development GPA; it references the 2011 sale deed as prior title history but does not itself evidence pre-2011 authority from the stated principals to the 2011 seller-agent."
      : laterPoaObserved && !preSalePoaObserved
      ? "ORERA title-flow says the 2011 sale was executed by a PoA holder, but the only observed PoA reference is dated after the sale; treat as a missing historical authority-document lead."
      : "ORERA title-flow says the sale was executed by a PoA holder, but no relevant authority document has been observed in the collected corpus.",
    next_evidence: unique(nextEvidence),
    title_flow_snippets: titleFlows.map((text) => String(text).slice(0, 700)),
  };
}

export function buildPoaAuthorityGapPackets(input) {
  const candidates = input.candidates || [];
  const context = {
    events: input.events || [],
    documents: input.documents || [],
    artifacts: input.artifacts || [],
    properties: input.properties || [],
    reviews: input.reviews || [],
    facts: input.facts || [],
  };
  return candidates
    .filter((candidate) => candidate.pattern_family === "poa_chain")
    .map((candidate) => buildPacket(candidate, context));
}
