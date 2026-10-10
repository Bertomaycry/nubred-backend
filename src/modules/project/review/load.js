import prisma from "../../../lib/prisma.js";
import { getSection, isSectionKey } from "../sections/registry.js";

export function requireSectionKey(sectionKey) {
  if (!isSectionKey(sectionKey)) {
    throw Object.assign(
      new Error(
        `Unknown section "${sectionKey}". ` +
          `Use one of: contract, genotype, phase, protocol, chronology.`
      ),
      { code: 400 }
    );
  }
  return getSection(sectionKey);
}

export async function getLatestSectionRow(projectId, sectionKey) {
  const run = await prisma.extractionRun.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      sections: {
        where: { sectionKey },
        include: {
          evidenceItems: { orderBy: { fieldPath: "asc" } },
        },
      },
    },
  });
  return run?.sections?.[0] ?? null;
}

export async function requireSucceededDraft(projectId, sectionKey) {
  const row = await getLatestSectionRow(projectId, sectionKey);
  if (!row || row.status !== "SUCCEEDED" || row.payload == null) {
    throw Object.assign(
      new Error(
        `Section "${sectionKey}" has no SUCCEEDED draft to review. ` +
          `Wait for extraction to finish this section first.`
      ),
      { code: 409 }
    );
  }
  return row;
}

export function serializeEvidence(item) {
  return {
    id: item.id,
    fieldPath: item.fieldPath,
    documentName: item.documentName,
    page: item.page,
    charOffset: item.charOffset,
    quote: item.quote,
    frameworkElement: item.frameworkElement,
    documentId: item.documentId,
  };
}

export function serializeOverride(row) {
  return {
    id: row.id,
    fieldPath: row.fieldPath,
    previousValue: row.previousValue,
    newValue: row.newValue,
    source: row.source,
    reason: row.reason,
    overriddenById: row.overriddenById,
    createdAt: row.createdAt,
  };
}

export function serializeConfirmation(row) {
  if (!row) return null;
  return {
    sectionKey: row.sectionKey,
    confirmedAt: row.confirmedAt,
    confirmedById: row.confirmedById,
    reviewState: row.reviewState,
    warningsAck: row.warningsAck,
  };
}
