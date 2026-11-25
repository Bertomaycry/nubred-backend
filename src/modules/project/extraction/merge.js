import {
  ensureRootRecord,
  fieldIsProtected,
  groupIdentityFor,
  recordMatchesIdentity,
  sectionIsLocked,
} from "../field-store/repository.js";
import { toFieldValueStatus, toPrismaConfidence } from "../field-store/status.js";
import { quoteVerifiedOnPages } from "./quote-check.js";
import { confidenceFromDocument } from "./confidence.js";
import { ROOT_GROUP_PATH } from "../sections/field-tree/build-zod.js";
import { fieldKeysForGroup } from "../sections/field-tree/traverse.js";

function valuesEqual(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Apply LLM extraction output for one document × section (one part).
 * @param {object} tx prisma transaction
 * @param {{
 *   projectId: string,
 *   section: import("../sections/make-section.js").SectionDefinition,
 *   sectionState: object,
 *   document: object & { pages?: object[] },
 *   records: Array<object>,
 *   parsed: { records: Array<object> },
 *   runStepId: string,
 *   defaultConfidence?: string,
 * }} params
 */
export async function mergeExtractionIntoStore(tx, params) {
  const {
    projectId,
    section,
    sectionState,
    document,
    parsed,
    runStepId,
    defaultConfidence,
  } = params;

  const locked = sectionIsLocked(sectionState);
  const docConfidence = toPrismaConfidence(
    defaultConfidence ?? confidenceFromDocument(document)
  );

  const existingRecords = await tx.sectionRecord.findMany({
    where: { projectId, sectionKey: section.key, deletedAt: null },
    include: { fieldValues: true },
  });
  const byId = new Map(existingRecords.map((r) => [r.id, r]));

  let sortOrder =
    Math.max(0, ...existingRecords.map((r) => r.sortOrder ?? 0)) + 1;
  let wrote = false;

  for (const proposed of parsed.records ?? []) {
    const groupPath =
      !proposed.group_path || proposed.group_path === ROOT_GROUP_PATH
        ? ""
        : proposed.group_path;
    const allowedKeys = fieldKeysForGroup(section.fieldTree.children, groupPath);
    const fieldEntries = Object.entries(proposed.fields ?? {}).filter(
      ([fieldKey, cell]) => cell && typeof cell === "object" && allowedKeys.has(fieldKey)
    );
    let record = null;

    if (proposed.ref && byId.has(proposed.ref)) {
      record = byId.get(proposed.ref);
    } else {
      const identityKeys = groupIdentityFor(section, groupPath);
      if (identityKeys.length) {
        record =
          existingRecords.find(
            (r) =>
              r.groupPath === groupPath &&
              recordMatchesIdentity(r, proposed.fields ?? {}, identityKeys)
          ) ?? null;
      }
    }

    if (!record && fieldEntries.length === 0) continue;

    if (!record) {
      record = await tx.sectionRecord.create({
        data: {
          projectId,
          sectionKey: section.key,
          groupPath,
          parentRecordId: proposed.parent_record_ref ?? null,
          sortOrder: sortOrder++,
          origin: "AI",
        },
        include: { fieldValues: true },
      });
      existingRecords.push(record);
      byId.set(record.id, record);
    }

    for (const [fieldKey, cell] of fieldEntries) {

      const status = toFieldValueStatus(cell.status);
      const value = cell.value ?? null;

      let fieldValue = await tx.fieldValue.findUnique({
        where: { recordId_fieldKey: { recordId: record.id, fieldKey } },
        include: { candidates: { where: { state: "OPEN" } } },
      });

      if (!fieldValue) {
        fieldValue = await tx.fieldValue.create({
          data: {
            recordId: record.id,
            fieldKey,
            value: status === "FOUND" ? value : null,
            status,
            confidence: docConfidence,
            review: "PENDING",
          },
        });
        wrote = true;
      }

      const protectedField = fieldIsProtected(fieldValue, locked);
      const verified = cell.quote
        ? quoteVerifiedOnPages(cell.quote, document.pages)
        : false;

      if (protectedField) {
        if (status === "FOUND" && value != null && !valuesEqual(fieldValue.value, value)) {
          await tx.fieldCandidate.create({
            data: {
              fieldValueId: fieldValue.id,
              runStepId,
              value,
              confidence: docConfidence,
              tag: "NEW",
              state: "OPEN",
            },
          });
          wrote = true;
        }
        continue;
      }

      const wasEmpty =
        fieldValue.status === "NOT_FOUND" || fieldValue.value == null;
      const foundNow = status === "FOUND" && value != null;

      if (!foundNow) {
        if (wasEmpty) {
          await tx.fieldValue.update({
            where: { id: fieldValue.id },
            data: { status, value: null },
          });
        }
        continue;
      }

      if (wasEmpty && foundNow) {
        await tx.fieldValue.update({
          where: { id: fieldValue.id },
          data: {
            value,
            status: "FOUND",
            confidence: docConfidence,
          },
        });
      } else if (valuesEqual(fieldValue.value, value)) {
        // same value — additional source only (evidence below)
      } else if (docConfidence === "CONFIRMED") {
        await tx.fieldCandidate.create({
          data: {
            fieldValueId: fieldValue.id,
            runStepId,
            value: fieldValue.value,
            confidence: fieldValue.confidence,
            tag: "NEW",
            state: "ARCHIVED",
          },
        });
        await tx.fieldValue.update({
          where: { id: fieldValue.id },
          data: {
            value,
            status: "FOUND",
            confidence: "CONFIRMED",
            review: "PENDING",
          },
        });
      } else {
        await tx.fieldCandidate.create({
          data: {
            fieldValueId: fieldValue.id,
            runStepId,
            value,
            confidence: docConfidence,
            tag: "NEW",
            state: "OPEN",
          },
        });
        await tx.fieldValue.update({
          where: { id: fieldValue.id },
          data: { confidence: "CONFLICTING" },
        });
      }

      if (cell.quote) {
        const candidate = await tx.fieldCandidate.findFirst({
          where: { fieldValueId: fieldValue.id, runStepId },
          orderBy: { createdAt: "desc" },
        });
        await tx.evidenceItem.create({
          data: {
            projectId,
            sectionKey: section.key,
            recordId: record.id,
            fieldKey,
            candidateId: candidate?.id ?? null,
            documentId: document.id,
            documentName: document.originalFilename,
            page: cell.page ?? null,
            quote: cell.quote,
            verified,
          },
        });
      }
    }
  }

  if (wrote && (locked || sectionState.status === "NOT_STARTED")) {
    await tx.sectionState.update({
      where: { projectId_sectionKey: { projectId, sectionKey: section.key } },
      data: { status: "TO_REVIEW" },
    });
  }

  await ensureRootRecord(tx, projectId, section.key);
  return wrote;
}