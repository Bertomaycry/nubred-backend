import { requireSectionKey } from "./load.js";
import { ensureSectionState } from "../field-store/repository.js";
import { getSectionReview } from "./get-section.js";

export async function patchReviewState({ db, projectId, sectionKey, patch }) {
  requireSectionKey(sectionKey);
  await ensureSectionState(db, projectId, sectionKey);
  const prev = await db.sectionState.findUnique({
    where: { projectId_sectionKey: { projectId, sectionKey } },
  });
  const reviewState = { ...(prev?.reviewState ?? {}), ...(patch ?? {}) };
  await db.sectionState.update({
    where: { projectId_sectionKey: { projectId, sectionKey } },
    data: { reviewState },
  });
  return getSectionReview(db, projectId, sectionKey);
}