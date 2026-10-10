import { Prisma } from "@prisma/client";
import prisma from "../../../lib/prisma.js";
import {
  assertWritableFieldPath,
  clonePayload,
  getAtPath,
  setAtPath,
} from "./path.js";
import { requireSectionKey, requireSucceededDraft } from "./load.js";

function formatZodPath(path) {
  return path.reduce((acc, part) => {
    if (typeof part === "number") return `${acc}[${part}]`;
    return acc ? `${acc}.${part}` : String(part);
  }, "");
}

function isEmptyValue(value) {
  return value === null || value === undefined;
}

function toJsonValue(value) {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value;
}

/**
 * Apply a VM edit to the latest SUCCEEDED draft. Writes FieldOverride (VM_MANUAL)
 * and marks fieldMeta.origin so the UI can show AI vs edited.
 *
 */
export async function patchSectionField({
  projectId,
  sectionKey,
  fieldPath,
  value,
  reason,
  userId,
  source = "VM_MANUAL",
}) {
  const section = requireSectionKey(sectionKey);
  const path = assertWritableFieldPath(fieldPath);
  const row = await requireSucceededDraft(projectId, sectionKey);

  if (value === undefined) {
    throw Object.assign(new Error("value is required (use null to clear a field)."), {
      code: 400,
    });
  }

  const nextPayload = clonePayload(row.payload);
  const previousValue = getAtPath(nextPayload, path);
  setAtPath(nextPayload, path, value);

  const parsed = section.schema.safeParse(nextPayload);
  if (!parsed.success) {
    throw Object.assign(
      new Error("Updated value failed section schema validation."),
      {
        code: 400,
        issues: parsed.error.issues.map((issue) => ({
          path: formatZodPath(issue.path),
          message: issue.message,
        })),
      }
    );
  }

  const fieldMeta = {
    ...(row.fieldMeta && typeof row.fieldMeta === "object" ? row.fieldMeta : {}),
  };
  const existing = fieldMeta[path] && typeof fieldMeta[path] === "object"
    ? fieldMeta[path]
    : { sources: [] };

  fieldMeta[path] = {
    ...existing,
    sources: Array.isArray(existing.sources) ? existing.sources : [],
    confidence: isEmptyValue(value) ? "MISSING" : "PROVISIONAL",
    origin: source === "CHATBOT" ? "CHATBOT" : "VM_MANUAL",
  };

  const [updated, override] = await prisma.$transaction([
    prisma.sectionExtraction.update({
      where: { id: row.id },
      data: {
        payload: parsed.data,
        fieldMeta,
      },
      include: {
        evidenceItems: { orderBy: { fieldPath: "asc" } },
      },
    }),
    prisma.fieldOverride.create({
      data: {
        projectId,
        sectionKey,
        fieldPath: path,
        previousValue: toJsonValue(previousValue),
        newValue: toJsonValue(value),
        source: source === "CHATBOT" ? "CHATBOT" : "VM_MANUAL",
        reason: typeof reason === "string" && reason.trim() ? reason.trim() : null,
        overriddenById: userId,
      },
    }),
  ]);

  return { section: updated, override };
}
