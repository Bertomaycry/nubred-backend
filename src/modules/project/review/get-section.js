import prisma from "../../../lib/prisma.js";
import { evaluateSectionRules } from "./evaluate-rules.js";
import {
  getLatestSectionRow,
  requireSectionKey,
  serializeConfirmation,
  serializeEvidence,
  serializeOverride,
} from "./load.js";

export async function getSectionReview(projectId, sectionKey) {
  const section = requireSectionKey(sectionKey);
  const row = await getLatestSectionRow(projectId, sectionKey);

  if (!row) {
    throw Object.assign(
      new Error(
        `No extraction found for section "${sectionKey}". Start an extraction first.`
      ),
      { code: 404 }
    );
  }

  const [confirmation, overrides] = await Promise.all([
    prisma.sectionConfirmation.findUnique({
      where: { projectId_sectionKey: { projectId, sectionKey } },
    }),
    prisma.fieldOverride.findMany({
      where: { projectId, sectionKey },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const evaluation = evaluateSectionRules(section.rules, {
    extraction: row.payload,
    fieldMeta: row.fieldMeta,
    reviewState: row.reviewState,
  });

  return {
    sectionKey: section.key,
    label: section.label,
    kind: section.kind,
    order: section.order,
    reviewTabs: section.rules?.reviewTabs ?? [],
    extraction: {
      id: row.id,
      extractionRunId: row.extractionRunId,
      status: row.status,
      error: row.error,
      payload: row.payload,
      fieldMeta: row.fieldMeta,
      reviewState: row.reviewState ?? {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      evidence: (row.evidenceItems ?? []).map(serializeEvidence),
    },
    rules: evaluation,
    confirmation: serializeConfirmation(confirmation),
    overrides: overrides.map(serializeOverride),
  };
}
