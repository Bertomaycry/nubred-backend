import { listGroups } from "../sections/field-tree/traverse.js";
import { getSection } from "../sections/registry.js";
import { badgeForField } from "./status.js";

export async function ensureSectionState(db, projectId, sectionKey) {
  return db.sectionState.upsert({
    where: { projectId_sectionKey: { projectId, sectionKey } },
    create: { projectId, sectionKey, status: "NOT_STARTED" },
    update: {},
  });
}

export async function ensureRootRecord(db, projectId, sectionKey) {
  const existing = await db.sectionRecord.findFirst({
    where: {
      projectId,
      sectionKey,
      groupPath: "",
      parentRecordId: null,
      deletedAt: null,
    },
  });
  if (existing) return existing;
  return db.sectionRecord.create({
    data: {
      projectId,
      sectionKey,
      groupPath: "",
      sortOrder: 0,
      origin: "VM",
    },
  });
}

export async function listSectionRecords(db, projectId, sectionKey) {
  return db.sectionRecord.findMany({
    where: { projectId, sectionKey, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      fieldValues: {
        include: {
          candidates: {
            where: { state: "OPEN" },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });
}

export async function loadSectionStore(db, projectId, sectionKey) {
  const section = getSection(sectionKey);
  const [state, records] = await Promise.all([
    ensureSectionState(db, projectId, sectionKey),
    listSectionRecords(db, projectId, sectionKey),
  ]);

  const flatFields = [];
  for (const record of records) {
    for (const fv of record.fieldValues) {
      const open = fv.candidates?.length ?? 0;
      flatFields.push({
        recordId: record.id,
        groupPath: record.groupPath,
        fieldKey: fv.fieldKey,
        value: fv.value,
        status: fv.status,
        confidence: fv.confidence,
        review: fv.review,
        openCandidates: open,
        badge: badgeForField(fv, open),
        required: false,
      });
    }
  }

  return { section, state, records, flatFields };
}

/**
 * Identity match for repeatable groups.
 * @param {object} record existing SectionRecord with fieldValues
 * @param {Record<string, unknown>} identityValues from LLM
 * @param {string[]} identityKeys
 */
export function recordMatchesIdentity(record, identityValues, identityKeys) {
  if (!identityKeys?.length) return false;
  const byKey = new Map(record.fieldValues.map((f) => [f.fieldKey, f.value]));
  return identityKeys.every((key) => {
    const a = normalizeScalar(byKey.get(key));
    const b = normalizeScalar(identityValues[key]);
    return a && b && a === b;
  });
}

function normalizeScalar(value) {
  if (value == null) return null;
  if (typeof value === "object" && value !== null && "text" in value) {
    return String(value.text).trim().toLowerCase();
  }
  return String(value).trim().toLowerCase();
}

export function groupIdentityFor(section, groupPath) {
  const groups = listGroups(section.fieldTree.children);
  const hit = groups.find((g) => g.path === groupPath || g.key === groupPath);
  return hit?.identity ?? [];
}

export function sectionIsLocked(state) {
  return state?.status === "CONFIRMED";
}

export function fieldIsProtected(fieldValue, sectionLocked) {
  if (sectionLocked) return true;
  const review = fieldValue?.review;
  return review === "ACCEPTED" || review === "EDITED" || review === "GAP";
}