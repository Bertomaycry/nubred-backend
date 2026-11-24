import { getSection, isSectionKey } from "../sections/registry.js";
import { listSectionRecords } from "../field-store/repository.js";
import { recordsToPayload } from "../field-store/payload.js";

export function requireSectionKey(sectionKey) {
  if (!isSectionKey(sectionKey)) {
    throw Object.assign(
      new Error(`Unknown section "${sectionKey}".`),
      { code: 400 }
    );
  }
  return getSection(sectionKey);
}

export async function getSectionState(db, projectId, sectionKey) {
  return db.sectionState.findUnique({
    where: { projectId_sectionKey: { projectId, sectionKey } },
  });
}

export async function loadSectionEvidence(db, projectId, sectionKey) {
  return db.evidenceItem.findMany({
    where: { projectId, sectionKey },
    orderBy: [{ fieldKey: "asc" }, { createdAt: "asc" }],
    take: 500,
  });
}

export async function requireSucceededDraft(db, projectId, sectionKey) {
  const records = await listSectionRecords(db, projectId, sectionKey);
  if (!records.length) {
    throw Object.assign(
      new Error(
        `Section "${sectionKey}" has no extracted data yet. Run extraction first.`
      ),
      { code: 409 }
    );
  }
  return {
    id: `${projectId}:${sectionKey}`,
    sectionKey,
    status: "SUCCEEDED",
    payload: recordsToPayload(records),
    fieldMeta: {},
    reviewState: {},
  };
}

export function serializeOverride(row) {
  return {
    id: row.id,
    fieldPath: row.fieldPath,
    recordId: row.recordId,
    fieldKey: row.fieldKey,
    previousValue: row.previousValue,
    newValue: row.newValue,
    source: row.source,
    reason: row.reason,
    overriddenById: row.overriddenById,
    createdAt: row.createdAt,
  };
}