import { chronologyExtractionSchema } from "../sections/chronology/chronology.schema.js";

const ISO_DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

function isIsoDate(value) {
  return typeof value === "string" && ISO_DATE.test(value.trim());
}

function addEvent(events, event) {
  events.push({
    event_type: event.event_type,
    description: event.description,
    date: event.date ?? null,
    date_precision: event.date_precision,
    date_notes: event.date_notes ?? null,
    actor: event.actor ?? null,
    source_section: event.source_section,
    linked_entity_type: event.linked_entity_type ?? null,
    linked_entity_ref: event.linked_entity_ref ?? null,
  });
}

function fromContract(payload, events) {
  if (!payload || typeof payload !== "object") return;
  const type = payload.contract_type ?? "contract";
  if (payload.effective_date) {
    addEvent(events, {
      event_type: "CONTRACT_SIGNATURE",
      description: `Contract ${type} effective.`,
      date: isIsoDate(payload.effective_date) ? payload.effective_date : null,
      date_precision: isIsoDate(payload.effective_date) ? "EXACT" : "INFERRED",
      date_notes: isIsoDate(payload.effective_date) ? null : String(payload.effective_date),
      source_section: "contract",
      linked_entity_type: "contract",
      linked_entity_ref: type,
    });
  }
  if (payload.end_date) {
    addEvent(events, {
      event_type: "OTHER",
      description: `Contract ${type} end / expiry.`,
      date: isIsoDate(payload.end_date) ? payload.end_date : null,
      date_precision: isIsoDate(payload.end_date) ? "EXACT" : "INFERRED",
      date_notes: isIsoDate(payload.end_date) ? null : String(payload.end_date),
      source_section: "contract",
      linked_entity_type: "contract",
      linked_entity_ref: type,
    });
  }
}

function fromGenotype(payload, events) {
  const genotypes = Array.isArray(payload?.genotypes) ? payload.genotypes : [];
  for (const genotype of genotypes) {
    if (!genotype?.ip_reference) continue;
    addEvent(events, {
      event_type: "IP_GRANT",
      description: `IP reference for ${genotype.name ?? "genotype"}: ${genotype.ip_reference}.`,
      date: null,
      date_precision: "ESTIMATED",
      date_notes: "Grant or application number extracted; filing date not present as a dedicated field.",
      source_section: "genotype",
      linked_entity_type: "genotype",
      linked_entity_ref: genotype.name ?? genotype.ip_reference,
    });
  }
}

function fromPhase(payload, events) {
  const phases = Array.isArray(payload?.phases) ? payload.phases : [];
  for (const phase of phases) {
    const label = phase.name ?? phase.type ?? "phase";
    if (phase.start_trigger) {
      addEvent(events, {
        event_type: "PHASE_START",
        description: `Phase "${label}" start trigger.`,
        date: null,
        date_precision: "INFERRED",
        date_notes: String(phase.start_trigger),
        source_section: "phase",
        linked_entity_type: "phase",
        linked_entity_ref: label,
      });
    }
    const decisions = Array.isArray(phase.genotype_decisions)
      ? phase.genotype_decisions
      : [];
    for (const decision of decisions) {
      addEvent(events, {
        event_type: "PHASE_ADVANCEMENT",
        description: `${decision.decision ?? "Decision"} for ${decision.genotype_name ?? "genotype"} in phase "${label}".`,
        date: isIsoDate(decision.decision_date) ? decision.decision_date : null,
        date_precision: isIsoDate(decision.decision_date) ? "EXACT" : "ESTIMATED",
        date_notes: isIsoDate(decision.decision_date)
          ? null
          : decision.decision_date ?? decision.notes ?? null,
        source_section: "phase",
        linked_entity_type: "phase",
        linked_entity_ref: label,
        actor: "IVM",
      });
    }
  }
}

function fromProtocol(payload, events) {
  const protocols = Array.isArray(payload?.protocols) ? payload.protocols : [];
  for (const protocol of protocols) {
    const name = protocol.name ?? "protocol";
    addEvent(events, {
      event_type: "OBSERVATION_MILESTONE",
      description: `Protocol "${name}" identified${protocol.linked_phase ? ` for ${protocol.linked_phase}` : ""}.`,
      date: null,
      date_precision: "INFERRED",
      date_notes: protocol.objective ?? "Protocol present in source documents; no observation dates extracted.",
      source_section: "protocol",
      linked_entity_type: "protocol",
      linked_entity_ref: name,
    });
  }
}

function fromDocuments(documents, events) {
  for (const doc of documents ?? []) {
    if (doc.documentType !== "EMAIL" && doc.documentType !== "MEETING_NOTES") {
      continue;
    }
    const date = doc.uploadedAt
      ? new Date(doc.uploadedAt).toISOString().slice(0, 10)
      : null;
    addEvent(events, {
      event_type: doc.documentType === "EMAIL" ? "EMAIL_EXCHANGE" : "MEETING_DECISION",
      description: `Source document "${doc.originalFilename}" (${doc.documentType}).`,
      date,
      date_precision: "ESTIMATED",
      date_notes: "Taken from document upload time; not a contractual date.",
      source_section: "document_metadata",
      linked_entity_type: "document",
      linked_entity_ref: doc.originalFilename,
    });
  }
}

const TYPE_ORDER = [
  "CONTRACT_SIGNATURE",
  "PHASE_START",
  "IP_FILING",
  "IP_GRANT",
  "PHASE_ADVANCEMENT",
  "PHASE_GATE",
  "OBSERVATION_MILESTONE",
  "MEETING_DECISION",
  "EMAIL_EXCHANGE",
  "OTHER",
];

function sortEvents(events) {
  return [...events].sort((a, b) => {
    const aDate = a.date ?? "9999";
    const bDate = b.date ?? "9999";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return TYPE_ORDER.indexOf(a.event_type) - TYPE_ORDER.indexOf(b.event_type);
  });
}

/**
 * Build a chronology payload from succeeded extractor sections (no LLM).
 *
 * @param {Record<string, object | null>} payloadsBySection
 * @param {Array<{ originalFilename: string, documentType: string, uploadedAt: Date | null }>} documents
 */
export function deriveChronology(payloadsBySection, documents) {
  const events = [];
  fromContract(payloadsBySection.contract, events);
  fromGenotype(payloadsBySection.genotype, events);
  fromPhase(payloadsBySection.phase, events);
  fromProtocol(payloadsBySection.protocol, events);
  fromDocuments(documents, events);

  const ordered = sortEvents(events);
  const evidence = ordered.map((event, index) => ({
    field_path: `events[${index}].description`,
    document_name: "derived",
    page: null,
    char_offset: null,
    quote: event.description,
    framework_element: `Derived from ${event.source_section}`,
  }));

  const payload = { events: ordered, evidence };
  const parsed = chronologyExtractionSchema.safeParse(payload);
  if (parsed.success) return parsed.data;

  return payload;
}
