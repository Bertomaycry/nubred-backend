import { asyncHandler } from "../utils/asyncHandler.js";
import { getSectionReview } from "../modules/project/review/get-section.js";
import { patchSectionField } from "../modules/project/review/patch-field.js";
import { patchReviewState } from "../modules/project/review/review-state.js";
import { confirmSectionReview } from "../modules/project/review/confirm.js";

function sendReviewError(res, error) {
  const code = typeof error.code === "number" ? error.code : 500;
  const body = { success: false, message: error.message };
  if (error.issues) body.issues = error.issues;
  if (error.blocking) body.blocking = error.blocking;
  if (error.rules) body.rules = error.rules;
  if (Number.isInteger(error.index)) body.index = error.index;
  return res.status(code).json(body);
}

export const getSection = asyncHandler(async (req, res) => {
  try {
    const review = await getSectionReview(
      req.db,
      req.project.id,
      req.params.sectionKey
    );
    res.status(200).json({ success: true, ...review });
  } catch (error) {
    if (typeof error.code === "number") return sendReviewError(res, error);
    throw error;
  }
});

export const patchField = asyncHandler(async (req, res) => {
  try {
    const review = await patchSectionField({
      db: req.db,
      projectId: req.project.id,
      sectionKey: req.params.sectionKey,
      userId: req.user.id,
      ...req.body,
    });
    res.status(200).json({
      success: true,
      message: Array.isArray(req.body?.actions) ? "Fields updated." : "Field updated.",
      ...review,
    });
  } catch (error) {
    if (typeof error.code === "number") return sendReviewError(res, error);
    throw error;
  }
});

export const patchSectionReviewState = asyncHandler(async (req, res) => {
  try {
    const review = await patchReviewState({
      db: req.db,
      projectId: req.project.id,
      sectionKey: req.params.sectionKey,
      patch: req.body,
    });
    res.status(200).json({ success: true, message: "Review state updated.", ...review });
  } catch (error) {
    if (typeof error.code === "number") return sendReviewError(res, error);
    throw error;
  }
});

export const confirmSectionHandler = asyncHandler(async (req, res) => {
  try {
    const review = await confirmSectionReview(
      req.db,
      req.project.id,
      req.params.sectionKey,
      req.user.id
    );
    res.status(200).json({
      success: true,
      message: "Section confirmed.",
      ...review,
    });
  } catch (error) {
    if (typeof error.code === "number") return sendReviewError(res, error);
    throw error;
  }
});