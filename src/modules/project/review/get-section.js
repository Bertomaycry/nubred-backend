import { evaluateSectionRules } from "./evaluate-rules.js";
import { requireSectionKey, loadSectionEvidence } from "./load.js";
import {
  ensureSectionState,
  listSectionRecords,
} from "../field-store/repository.js";
import { serializeSectionPayload } from "../field-store/serialize.js";
import { noticeForSection } from "../extraction/failure-message.js";

export async function getSectionReview(db, projectId, sectionKey) {
  const section = requireSectionKey(sectionKey);
  const state = await ensureSectionState(db, projectId, section.key);
  const records = await listSectionRecords(db, projectId, section.key);
  const evidence = await loadSectionEvidence(db, projectId, section.key);

  const body = serializeSectionPayload(section, state, records, evidence);

  const evaluation = evaluateSectionRules(section.rules, {
    extraction: body,
    chipCounts: body.chipCounts,
    requiredMissing: body.requiredMissing,
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
      body.chipCounts.all,
      latest?.status
    ),
  };
}