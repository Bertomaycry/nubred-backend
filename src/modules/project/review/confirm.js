import { confirmSection } from "../field-store/actions.js";
import { getSectionReview } from "./get-section.js";

export async function confirmSectionReview(db, projectId, sectionKey, userId) {
  const review = await getSectionReview(db, projectId, sectionKey);
  if (!review.rules?.canConfirm) {
    throw Object.assign(
      new Error("Section cannot be confirmed until blocking rules pass."),
      { code: 409, rules: review.rules }
    );
  }
  await confirmSection(db, { projectId, sectionKey, userId });
  return getSectionReview(db, projectId, sectionKey);
}