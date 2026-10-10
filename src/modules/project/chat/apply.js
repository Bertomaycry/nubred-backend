import prisma from "../../../lib/prisma.js";
import { getAtPath } from "../review/path.js";
import { patchSectionField } from "../review/patch-field.js";
import { requireSucceededDraft } from "../review/load.js";
import {
  coerceLlmValue,
  fieldLabelFromPath,
  stringifyDisplay,
} from "./intents.js";
import { downstreamWarning } from "./context.js";

/**
 * Apply chatbot field writes. Returns display diffs (including no-ops that
 * still resolve a conflict by restating the current value).
 */
export async function applyChatChanges({
  projectId,
  sectionKey,
  userId,
  changes,
  reason,
}) {
  if (!changes?.length) {
    throw Object.assign(new Error("No field changes to apply."), { code: 400 });
  }

  const applied = [];
  const issues = [];
  let lastSection = null;

  for (const change of changes) {
    const fieldPath = change.fieldPath ?? change.field_path;
    if (!fieldPath) continue;
    const value = "value" in change ? change.value : coerceLlmValue(change.new_value ?? change.newValue);

    try {
      const before = await requireSucceededDraft(projectId, sectionKey);
      const previousValue = getAtPath(before.payload, fieldPath);
      const { section } = await patchSectionField({
        projectId,
        sectionKey,
        fieldPath,
        value,
        reason,
        userId,
        source: "CHATBOT",
      });
      lastSection = section;
      applied.push({
        fieldPath,
        fieldLabel: change.fieldLabel ?? change.field_label ?? fieldLabelFromPath(fieldPath),
        previousValue: previousValue === undefined ? null : previousValue,
        newValue: getAtPath(section.payload, fieldPath) ?? value,
      });
    } catch (error) {
      if (error.code === 400) {
        issues.push({
          fieldPath,
          message: error.message,
          issues: error.issues,
        });
        continue;
      }
      throw error;
    }
  }

  if (applied.length === 0) {
    throw Object.assign(
      new Error(
        issues[0]?.message ??
          "None of the proposed values fit the target field schema."
      ),
      { code: 400, issues: issues.flatMap((item) => item.issues ?? []) }
    );
  }

  const warning = await downstreamWarning(projectId, sectionKey);
  return { applied, issues, section: lastSection, warning };
}

export async function appendFieldEvidence({
  projectId,
  sectionKey,
  fieldPath,
  sources,
  documents,
}) {
  const row = await requireSucceededDraft(projectId, sectionKey);
  const byName = new Map(
    (documents ?? []).map((doc) => [doc.originalFilename.toLowerCase(), doc])
  );

  const items = (sources ?? [])
    .filter((source) => source.quote || source.document_name || source.documentName)
    .map((source) => {
      const name = String(source.document_name ?? source.documentName ?? "").trim();
      const match = byName.get(name.toLowerCase());
      return {
        projectId,
        sectionExtractionId: row.id,
        documentId: match?.id ?? source.documentId ?? null,
        sectionKey,
        fieldPath,
        documentName: name || match?.originalFilename || "unknown",
        page: Number.isInteger(source.page) ? source.page : null,
        quote: String(source.quote ?? ""),
      };
    });

  if (items.length === 0) return;

  await prisma.evidenceItem.createMany({ data: items });

  const fieldMeta = {
    ...(row.fieldMeta && typeof row.fieldMeta === "object" ? row.fieldMeta : {}),
  };
  const existing = fieldMeta[fieldPath] && typeof fieldMeta[fieldPath] === "object"
    ? fieldMeta[fieldPath]
    : {};
  const extraSources = items.map((item) => item.documentName).filter(Boolean);
  fieldMeta[fieldPath] = {
    ...existing,
    sources: [...new Set([...(existing.sources ?? []), ...extraSources])],
    confidence: existing.confidence === "MISSING" ? "PROVISIONAL" : existing.confidence ?? "PROVISIONAL",
    origin: "CHATBOT",
  };
  await prisma.sectionExtraction.update({
    where: { id: row.id },
    data: { fieldMeta },
  });
}

export function changeCountMessage(applied) {
  const n = applied.length;
  return `Change applied ${n} field${n === 1 ? "" : "s"} affected.`;
}

export function toChangeCards(applied) {
  return applied.map((item) => ({
    fieldPath: item.fieldPath,
    fieldLabel: item.fieldLabel,
    previousValue: item.previousValue,
    previousDisplay: stringifyDisplay(item.previousValue) ?? "—",
    newValue: item.newValue,
    newDisplay: stringifyDisplay(item.newValue) ?? "—",
  }));
}
