import { downstreamWarning } from "./context.js";
import { requireSectionKey } from "../review/load.js";

/**
 * Chat writes become OPEN candidates — never direct field values.
 */
export async function applyChatChanges({
  db,
  projectId,
  sectionKey,
  userId,
  changes,
}) {
  if (!changes?.length) {
    throw Object.assign(new Error("No field changes to apply."), { code: 400 });
  }
  requireSectionKey(sectionKey);

  const applied = [];
  for (const change of changes) {
    const recordId = change.recordId ?? change.record_id;
    const fieldKey = change.fieldKey ?? change.field_key;
    const value = change.value ?? change.new_value ?? change.newValue;
    if (!recordId || !fieldKey) continue;

    let fieldValue = await db.fieldValue.findUnique({
      where: { recordId_fieldKey: { recordId, fieldKey } },
    });
    if (!fieldValue) {
      fieldValue = await db.fieldValue.create({
        data: { recordId, fieldKey, status: "NOT_FOUND", review: "PENDING" },
      });
    }

    const candidate = await db.fieldCandidate.create({
      data: {
        fieldValueId: fieldValue.id,
        value,
        confidence: "PROVISIONAL",
        tag: "CHATBOT",
        state: "OPEN",
      },
    });

    await db.fieldValue.update({
      where: { id: fieldValue.id },
      data: { confidence: "CONFLICTING" },
    });

    applied.push({ recordId, fieldKey, candidateId: candidate.id, value });
  }

  if (!applied.length) {
    throw Object.assign(new Error("No valid field targets in chat changes."), {
      code: 400,
    });
  }

  const warning = await downstreamWarning(db, projectId, sectionKey);
  return { applied, warning };
}

export async function appendFieldEvidence({
  db,
  projectId,
  sectionKey,
  recordId,
  fieldKey,
  sources,
  documents,
}) {
  const byName = new Map(
    (documents ?? []).map((doc) => [doc.originalFilename.toLowerCase(), doc])
  );

  const items = (sources ?? [])
    .filter((s) => s.quote)
    .map((source) => {
      const name = String(source.document_name ?? source.documentName ?? "").trim();
      const match = byName.get(name.toLowerCase());
      return {
        projectId,
        sectionKey,
        recordId,
        fieldKey,
        documentId: match?.id ?? null,
        documentName: name || match?.originalFilename || "unknown",
        page: Number.isInteger(source.page) ? source.page : null,
        quote: String(source.quote ?? ""),
        verified: false,
      };
    });

  if (items.length) await db.evidenceItem.createMany({ data: items });
}

export function changeCountMessage(applied) {
  const n = applied.length;
  return `Proposed ${n} candidate${n === 1 ? "" : "s"} for review.`;
}

export function toChangeCards(applied) {
  return applied.map((item) => ({
    recordId: item.recordId,
    fieldKey: item.fieldKey,
    candidateId: item.candidateId,
    newValue: item.value,
  }));
}