import {
  asEnum,
  asFloat,
  asInt,
  asIsoCountryCodes,
  CHRONOLOGY_EVENT_TYPES,
  CONTRACT_FAMILIES,
  DATE_PRECISIONS,
  DEVELOPMENT_STATUSES,
  ELIMINATORY_LEVELS,
  FLAG_SEVERITIES,
  FLAG_TYPES,
  FREQUENCY_TYPES,
  GENOTYPE_DECISIONS,
  PARAMETER_FAMILIES,
  PARAMETER_INPUT_TYPES,
  PARAMETER_LEVELS,
  PARTY_ROLES,
  PHASE_CATEGORIES,
  PHASE_TYPES,
  PROTOCOL_TYPES,
  SCALE_POLARITIES,
} from "./enums.js";

/**
 * Copy a confirmed section payload into domain tables.
 * Re-confirm replaces the previous snapshot's rows for that section.
 *
 * @param {import("@prisma/client").Prisma.TransactionClient} tx
 */
export async function promoteConfirmedSection(tx, { projectId, sectionKey, payload }) {
  switch (sectionKey) {
    case "contract":
      return promoteContract(tx, projectId, payload);
    case "genotype":
      return promoteGenotype(tx, projectId, payload);
    case "phase":
      return promotePhase(tx, projectId, payload);
    case "protocol":
      return promoteProtocol(tx, projectId, payload);
    case "chronology":
      return promoteChronology(tx, projectId, payload);
    default:
      return;
  }
}

async function promoteContract(tx, projectId, payload) {
  const existing = await tx.projectContract.findFirst({ where: { projectId } });
  const data = {
    contractType: asEnum(payload?.contract_type, CONTRACT_FAMILIES),
    economicFunction: payload?.economic_function ?? null,
    classificationConfidence:
      typeof payload?.confidence_score === "number" ? payload.confidence_score : null,
    contractLanguage: payload?.contract_language ?? null,
    governingLaw: payload?.governing_law ?? null,
    effectiveDate: payload?.effective_date ?? null,
    endDate: payload?.end_date ?? null,
    evaluationPeriod: payload?.evaluation_period ?? null,
    renewalMechanism: payload?.renewal_mechanism ?? null,
    payload,
  };

  const contract = existing
    ? await tx.projectContract.update({ where: { id: existing.id }, data })
    : await tx.projectContract.create({ data: { projectId, ...data } });

  await tx.contractParty.deleteMany({ where: { contractId: contract.id } });
  await tx.contractClause.deleteMany({ where: { contractId: contract.id } });

  const parties = Array.isArray(payload?.parties) ? payload.parties : [];
  if (parties.length) {
    await tx.contractParty.createMany({
      data: parties.map((party) => ({
        contractId: contract.id,
        name: party?.name ?? null,
        role: asEnum(party?.role, PARTY_ROLES),
        country: party?.country ?? null,
      })),
    });
  }

  const flags = Array.isArray(payload?.flags) ? payload.flags : [];
  const clauses = flags
    .filter((flag) => typeof flag?.clause_id === "string" && flag.clause_id.trim())
    .map((flag) => ({
      contractId: contract.id,
      clauseId: flag.clause_id.trim(),
      present: flag.type !== "ABSENCE",
      flagType: asEnum(flag.type, FLAG_TYPES),
      severity: asEnum(flag.severity, FLAG_SEVERITIES),
      note: flag.note ?? null,
    }));
  if (clauses.length) {
    await tx.contractClause.createMany({ data: clauses });
  }
}

async function promoteGenotype(tx, projectId, payload) {
  await tx.project.update({
    where: { id: projectId },
    data: {
      primarySpeciesBotanical: payload?.primary_species_botanical ?? null,
      primarySpeciesCommon: payload?.primary_species_common ?? null,
    },
  });

  const existing = await tx.genotype.findMany({ where: { projectId } });
  const byName = new Map(
    existing
      .filter((row) => typeof row.name === "string" && row.name.trim())
      .map((row) => [row.name.trim().toLowerCase(), row])
  );

  for (const entry of payload?.genotypes ?? []) {
    const name = typeof entry?.name === "string" ? entry.name.trim() : null;
    const key = name?.toLowerCase() ?? null;
    const data = {
      name,
      breederCode: entry?.breeder_code ?? null,
      speciesBotanical: entry?.species_botanical ?? payload?.primary_species_botanical ?? null,
      speciesCommon: entry?.species_common ?? payload?.primary_species_common ?? null,
      developmentStatus: asEnum(entry?.development_status, DEVELOPMENT_STATUSES),
      numberOfPlants: asInt(entry?.number_of_plants),
      ipReference: entry?.ip_reference ?? null,
      notes: entry?.notes ?? null,
    };

    if (key && byName.has(key)) {
      await tx.genotype.update({ where: { id: byName.get(key).id }, data });
    } else {
      await tx.genotype.create({ data: { projectId, ...data } });
    }
  }
}

async function promotePhase(tx, projectId, payload) {
  await tx.phase.deleteMany({ where: { projectId } });

  const genotypes = await tx.genotype.findMany({ where: { projectId } });
  const genotypeByName = new Map(
    genotypes
      .filter((row) => typeof row.name === "string" && row.name.trim())
      .map((row) => [row.name.trim().toLowerCase(), row])
  );

  for (const [index, entry] of (payload?.phases ?? []).entries()) {
    const phase = await tx.phase.create({
      data: {
        projectId,
        name: entry?.name ?? null,
        type: asEnum(entry?.type, PHASE_TYPES),
        category: asEnum(entry?.phase_category, PHASE_CATEGORIES),
        typeMappingNote: entry?.type_mapping_note ?? null,
        objective: entry?.objective ?? null,
        duration: entry?.duration ?? null,
        startTrigger: entry?.start_trigger ?? null,
        location: entry?.location ?? null,
        countries: asIsoCountryCodes(entry?.countries),
        plantCount: asInt(entry?.plant_count),
        hectares: asFloat(entry?.hectares),
        gateCriteria: Array.isArray(entry?.gate_criteria) ? entry.gate_criteria : null,
        capitolatoDefined:
          typeof entry?.capitolato_defined === "boolean" ? entry.capitolato_defined : null,
        sortOrder: index,
      },
    });

    const links = [];
    const seen = new Set();
    for (const decision of entry?.genotype_decisions ?? []) {
      const key = decision?.genotype_name?.trim?.().toLowerCase?.();
      const genotype = key ? genotypeByName.get(key) : null;
      if (!genotype || seen.has(genotype.id)) continue;
      seen.add(genotype.id);
      links.push({
        phaseId: phase.id,
        genotypeId: genotype.id,
        decision: asEnum(decision.decision, GENOTYPE_DECISIONS),
        decisionDate: decision.decision_date ?? null,
        notes: decision.notes ?? null,
      });
    }
    if (links.length) {
      await tx.phaseGenotype.createMany({ data: links });
    }
  }
}

async function promoteProtocol(tx, projectId, payload) {
  await tx.protocol.deleteMany({ where: { projectId } });

  const phases = await tx.phase.findMany({ where: { projectId } });
  const phaseByType = new Map();
  for (const phase of phases) {
    if (phase.type && !phaseByType.has(phase.type)) {
      phaseByType.set(phase.type, phase);
    }
  }

  for (const entry of payload?.protocols ?? []) {
    const linkedPhase = asEnum(entry?.linked_phase, PHASE_TYPES);
    const protocol = await tx.protocol.create({
      data: {
        projectId,
        phaseId: linkedPhase ? phaseByType.get(linkedPhase)?.id ?? null : null,
        name: entry?.name ?? null,
        objective: entry?.objective ?? null,
        protocolType: asEnum(entry?.protocol_type, PROTOCOL_TYPES),
        linkedPhase,
        sourceDocument: entry?.source_document ?? null,
      },
    });

    const parameters = Array.isArray(entry?.parameters) ? entry.parameters : [];
    if (!parameters.length) continue;

    await tx.protocolParameter.createMany({
      data: parameters.map((param) => ({
        protocolId: protocol.id,
        name: param?.name || "Unnamed parameter",
        nubredStandardName: param?.nubred_standard_name ?? null,
        family: asEnum(param?.parameter_family, PARAMETER_FAMILIES),
        parameterLevel: asEnum(param?.parameter_level, PARAMETER_LEVELS),
        inputType: asEnum(param?.input_type, PARAMETER_INPUT_TYPES),
        scaleMin: asFloat(param?.scale_min),
        scaleMax: asFloat(param?.scale_max),
        scalePolarity: asEnum(param?.scale_polarity, SCALE_POLARITIES),
        howToMeasure: param?.how_to_measure ?? null,
        unit: param?.unit ?? null,
        frequencyType: asEnum(param?.frequency_type, FREQUENCY_TYPES),
        frequencyValue: param?.frequency_value ?? null,
        dataCollectionWindow: param?.data_collection_window ?? null,
        sampleSize: param?.sample_size ?? null,
        threshold: param?.threshold ?? null,
        thresholdType: param?.threshold_type ?? null,
        eliminatoryLevel: asEnum(param?.eliminatory_level, ELIMINATORY_LEVELS),
        isCustom: param?.parameter_level === "PROJECT_CUSTOM",
      })),
    });
  }
}

async function promoteChronology(tx, projectId, payload) {
  await tx.chronologyEvent.deleteMany({ where: { projectId } });

  const events = Array.isArray(payload?.events) ? payload.events : [];
  if (!events.length) return;

  await tx.chronologyEvent.createMany({
    data: events.map((event) => ({
      projectId,
      eventType: asEnum(event?.event_type, CHRONOLOGY_EVENT_TYPES, "OTHER"),
      description:
        typeof event?.description === "string" && event.description.trim()
          ? event.description
          : event?.event_type || "Event",
      date: event?.date ?? null,
      datePrecision: asEnum(event?.date_precision, DATE_PRECISIONS, "INFERRED"),
      dateNotes: event?.date_notes ?? null,
      actor: event?.actor ?? null,
      sourceSection: event?.source_section ?? null,
      linkedEntityType: event?.linked_entity_type ?? null,
      linkedEntityRef: event?.linked_entity_ref ?? null,
    })),
  });
}
