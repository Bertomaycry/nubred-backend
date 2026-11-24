import { markUpstreamChanged } from "../extraction/derive-engine.js";

export async function acceptField(db, { recordId, fieldKey, userId }) {
  return db.fieldValue.update({
    where: { recordId_fieldKey: { recordId, fieldKey } },
    data: {
      review: "ACCEPTED",
      confidence: "CONFIRMED",
      reviewedById: userId,
      reviewedAt: new Date(),
    },
  });
}

export async function editField(
  db,
  { projectId, sectionKey, recordId, fieldKey, value, userId, reason }
) {
  const existing = await db.fieldValue.findUnique({
    where: { recordId_fieldKey: { recordId, fieldKey } },
  });

  await db.fieldOverride.create({
    data: {
      projectId,
      sectionKey,
      fieldPath: `${recordId}.${fieldKey}`,
      recordId,
      fieldKey,
      previousValue: existing?.value ?? null,
      newValue: value,
      source: "VM_MANUAL",
      reason,
      overriddenById: userId,
    },
  });

  return db.fieldValue.update({
    where: { recordId_fieldKey: { recordId, fieldKey } },
    data: {
      value,
      status: "FOUND",
      review: "EDITED",
      confidence: "CONFIRMED",
      reviewedById: userId,
      reviewedAt: new Date(),
    },
  });
}

export async function gapField(db, { recordId, fieldKey, userId }) {
  return db.fieldValue.update({
    where: { recordId_fieldKey: { recordId, fieldKey } },
    data: {
      review: "GAP",
      reviewedById: userId,
      reviewedAt: new Date(),
    },
  });
}

export async function chooseCandidate(db, { candidateId, userId }) {
  const candidate = await db.fieldCandidate.findUnique({
    where: { id: candidateId },
    include: { fieldValue: true },
  });
  if (!candidate) throw Object.assign(new Error("Candidate not found."), { code: 404 });

  await db.fieldCandidate.updateMany({
    where: { fieldValueId: candidate.fieldValueId, state: "OPEN" },
    data: { state: "REJECTED" },
  });

  await db.fieldCandidate.update({
    where: { id: candidate.id },
    data: { state: "CHOSEN" },
  });

  return db.fieldValue.update({
    where: { id: candidate.fieldValueId },
    data: {
      value: candidate.value,
      status: "FOUND",
      confidence: candidate.confidence,
      review: "ACCEPTED",
      reviewedById: userId,
      reviewedAt: new Date(),
    },
  });
}

export async function addRecord(db, { projectId, sectionKey, groupPath, parentRecordId }) {
  const max = await db.sectionRecord.aggregate({
    where: { projectId, sectionKey, groupPath },
    _max: { sortOrder: true },
  });
  return db.sectionRecord.create({
    data: {
      projectId,
      sectionKey,
      groupPath,
      parentRecordId: parentRecordId ?? null,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
      origin: "VM",
    },
  });
}

export async function softDeleteRecord(db, recordId) {
  return db.sectionRecord.update({
    where: { id: recordId },
    data: { deletedAt: new Date() },
  });
}

export async function confirmSection(db, { projectId, sectionKey, userId }) {
  const row = await db.sectionState.update({
    where: { projectId_sectionKey: { projectId, sectionKey } },
    data: {
      status: "CONFIRMED",
      confirmedById: userId,
      confirmedAt: new Date(),
    },
  });
  await markUpstreamChanged(db, projectId, sectionKey);
  return row;
}