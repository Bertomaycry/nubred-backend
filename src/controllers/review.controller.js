import { asyncHandler } from "../utils/asyncHandler.js";
import { getSection as getSectionDef } from "../modules/project/sections/registry.js";
import { evaluateSectionRules } from "../modules/project/review/evaluate-rules.js";
import { getSectionReview } from "../modules/project/review/get-section.js";
import { patchSectionField } from "../modules/project/review/patch-field.js";
import { patchReviewState } from "../modules/project/review/review-state.js";
import { confirmSection } from "../modules/project/review/confirm.js";

function sendReviewError(res, error) {
  const code = typeof error.code === "number" ? error.code : 500;
  const body = { success: false, message: error.message };
  if (error.issues) body.issues = error.issues;
  if (error.blocking) body.blocking = error.blocking;
  if (error.warnings) body.warnings = error.warnings;
  return res.status(code).json(body);
}

function serializeDraft(row) {
  return {
    id: row.id,
    extractionRunId: row.extractionRunId,
    sectionKey: row.sectionKey,
    status: row.status,
    payload: row.payload,
    fieldMeta: row.fieldMeta,
    reviewState: row.reviewState ?? {},
    updatedAt: row.updatedAt,
  };
}

function evaluateDraft(row) {
  const def = getSectionDef(row.sectionKey);
  return evaluateSectionRules(def.rules, {
    extraction: row.payload,
    fieldMeta: row.fieldMeta,
    reviewState: row.reviewState,
  });
}

// @desc    Latest draft + rules + confirmation for one section
// @route   GET /api/projects/:projectId/sections/:sectionKey
// @access  Private (viewer)
export const getSection = asyncHandler(async (req, res) => {
  try {
    const review = await getSectionReview(req.project.id, req.params.sectionKey);
    res.status(200).json({
      success: true,
      ...review,
    });
  } catch (error) {
    if (typeof error.code === "number") return sendReviewError(res, error);
    throw error;
  }
});

// @desc    Patch one draft field (VM edit / resolve conflict)
// @route   PATCH /api/projects/:projectId/sections/:sectionKey/fields
// @access  Private (VM)
export const patchField = asyncHandler(async (req, res) => {
  try {
    const { section } = await patchSectionField({
      projectId: req.project.id,
      sectionKey: req.params.sectionKey,
      fieldPath: req.body?.fieldPath,
      value: req.body?.value,
      reason: req.body?.reason,
      userId: req.user.id,
    });
    res.status(200).json({
      success: true,
      message: "Field updated.",
      extraction: serializeDraft(section),
      rules: evaluateDraft(section),
    });
  } catch (error) {
    if (typeof error.code === "number") return sendReviewError(res, error);
    throw error;
  }
});

// @desc    Record review-tab state (e.g. gapsTabViewed)
// @route   PATCH /api/projects/:projectId/sections/:sectionKey/review-state
// @access  Private (VM)
export const patchSectionReviewState = asyncHandler(async (req, res) => {
  try {
    const section = await patchReviewState({
      projectId: req.project.id,
      sectionKey: req.params.sectionKey,
      patch: req.body,
    });
    res.status(200).json({
      success: true,
      message: "Review state updated.",
      extraction: serializeDraft(section),
      rules: evaluateDraft(section),
    });
  } catch (error) {
    if (typeof error.code === "number") return sendReviewError(res, error);
    throw error;
  }
});

// @desc    Confirm a section: evaluate rules, lock snapshot, promote domain rows
// @route   POST /api/projects/:projectId/sections/:sectionKey/confirm
// @access  Private (VM)
export const confirmSectionHandler = asyncHandler(async (req, res) => {
  try {
    const { confirmation, evaluation } = await confirmSection({
      projectId: req.project.id,
      sectionKey: req.params.sectionKey,
      userId: req.user.id,
      warningsAck: req.body?.warningsAck,
    });
    res.status(200).json({
      success: true,
      message: "Section confirmed.",
      confirmation: {
        sectionKey: confirmation.sectionKey,
        confirmedAt: confirmation.confirmedAt,
        confirmedById: confirmation.confirmedById,
        reviewState: confirmation.reviewState,
        warningsAck: confirmation.warningsAck,
      },
      rules: evaluation,
    });
  } catch (error) {
    if (typeof error.code === "number") return sendReviewError(res, error);
    throw error;
  }
});
