import { evaluateSectionRules } from "./evaluate-rules.js";
import { requireSectionKey, loadSectionEvidence } from "./load.js";
import {
  ensureSectionState,
  listSectionRecords,
} from "../field-store/repository.js";
import { serializeSectionPayload } from "../field-store/serialize.js";
import { computeChipCounts } from "../field-store/chip-counts.js";
import { badgeForField } from "../field-store/status.js";
import { noticeForSection } from "../extraction/failure-message.js";

export async function getSectionReview(db, projectId, sectionKey) {
  const section = requireSectionKey(sectionKey);
  const state = await ensureSectionState(db, projectId, section.key);
  const records = await listSectionRecords(db, projectId, section.key);
  const evidence = await loadSectionEvidence(db, projectId, section.key);

  const body = serializeSectionPayload(section, state, records, evidence);

  const flatFields = [];
  for (const record of records) {
    for (const fv of record.fieldValues) {
      const open = fv.candidates?.filter((c) => c.state === "OPEN")?.length ?? 0;
      flatFields.push({
        fieldKey: fv.fieldKey,
        badge: badgeForField(fv, open),
        required: false,
      });
    }
  }
  const { chipCounts, requiredMissing } = computeChipCounts(section, flatFields);

  const evaluation = evaluateSectionRules(section.rules, {
    extraction: body,
    chipCounts,
    requiredMissing,
    reviewState: state.reviewState ?? {},
  });

  const latest = await db.extractionRun.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      steps: { select: { sectionKey: true, status: true, error: true } },
    },
  });

  return {
    ...body,
    rules: evaluation,
    canConfirm: evaluation.canConfirm,
    extractionMessage: noticeForSection(
      latest?.steps ?? [],
      section.key,
      chipCounts.all,
      latest?.status
    ),
  };
}