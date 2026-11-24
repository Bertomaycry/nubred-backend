import { walkFields } from "../sections/field-tree/traverse.js";
import { badgeForField } from "./status.js";
import { computeChipCounts } from "./chip-counts.js";

export function serializeSectionList(enabledSections, states, countBySection, messages = {}) {
  return enabledSections.map((section) => {
    const state = states.find((s) => s.sectionKey === section.key);
    return {
      key: section.key,
      label: section.label,
      order: section.order,
      kind: section.kind,
      status: state?.status ?? "NOT_STARTED",
      upstreamChangedAt: state?.upstreamChangedAt,
      confirmedAt: state?.confirmedAt,
      chipCounts: countBySection[section.key]?.chipCounts ?? null,
      extractionMessage: messages[section.key] ?? null,
    };
  });
}

export function serializeSectionPayload(section, state, records, evidence) {
  const fieldDefs = new Map(
    walkFields(section.fieldTree.children, { includeDerived: true }).map((f) => [
      f.key,
      f,
    ])
  );

  const flatFields = [];
  for (const record of records) {
    for (const fv of record.fieldValues) {
      const def = fieldDefs.get(fv.fieldKey);
      const open = fv.candidates?.filter((c) => c.state === "OPEN")?.length ?? 0;
      flatFields.push({
        recordId: record.id,
        groupPath: record.groupPath,
        fieldKey: fv.fieldKey,
        label: def?.label ?? fv.fieldKey,
        value: fv.value,
        status: fv.status,
        confidence: fv.confidence,
        review: fv.review,
        badge: badgeForField(fv, open),
        required: Boolean(def?.required),
        readOnly: Boolean(def?.derive),
        candidates: (fv.candidates ?? []).map(serializeCandidate),
        sources: (evidence ?? []).filter(
          (e) => e.recordId === record.id && e.fieldKey === fv.fieldKey
        ),
      });
    }
  }

  const { chipCounts, requiredMissing } = computeChipCounts(section, flatFields);

  return {
    sectionKey: section.key,
    label: section.label,
    kind: section.kind,
    status: state.status,
    upstreamChangedAt: state.upstreamChangedAt,
    confirmedAt: state.confirmedAt,
    records: records.map((r) => ({
      id: r.id,
      groupPath: r.groupPath,
      parentRecordId: r.parentRecordId,
      sortOrder: r.sortOrder,
      origin: r.origin,
      tag: r.tag,
      deletedAt: r.deletedAt,
      fields: r.fieldValues.map((fv) => ({
        fieldKey: fv.fieldKey,
        value: fv.value,
        status: fv.status,
        confidence: fv.confidence,
        review: fv.review,
        candidates: (fv.candidates ?? []).map(serializeCandidate),
      })),
    })),
    chipCounts,
    requiredMissing,
    reviewTabs: section.rules?.reviewTabs ?? [],
  };
}

function serializeCandidate(row) {
  return {
    id: row.id,
    value: row.value,
    confidence: row.confidence,
    tag: row.tag,
    state: row.state,
    createdAt: row.createdAt,
  };
}