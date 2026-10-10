import { asyncHandler } from "../utils/asyncHandler.js";
import { getSection as getSectionDef } from "../modules/project/sections/registry.js";
import { evaluateSectionRules } from "../modules/project/review/evaluate-rules.js";
import { runSectionChat } from "../modules/project/chat/run.js";

function sendChatError(res, error) {
  const code = typeof error.code === "number" ? error.code : 500;
  const body = { success: false, message: error.message };
  if (error.issues) body.issues = error.issues;
  return res.status(code).json(body);
}

function withRules(payload) {
  if (!payload?.extraction?.payload) return payload;
  const def = getSectionDef(payload.extraction.sectionKey);
  return {
    ...payload,
    rules: evaluateSectionRules(def.rules, {
      extraction: payload.extraction.payload,
      fieldMeta: payload.extraction.fieldMeta,
      reviewState: payload.extraction.reviewState,
    }),
  };
}

// @desc    Section review chatbot (usual, source, conflict, missing, apply)
// @route   POST /api/projects/:projectId/sections/:sectionKey/chat
// @access  Private (VM)
export const postSectionChat = asyncHandler(async (req, res) => {
  try {
    const result = await runSectionChat({
      projectId: req.project.id,
      sectionKey: req.params.sectionKey,
      userId: req.user.id,
      message: req.body?.message,
      history: req.body?.history,
      intent: req.body?.intent,
      fieldPath: req.body?.fieldPath,
      documentIds: req.body?.documentIds,
      value: req.body?.value,
    });
    res.status(200).json({
      success: true,
      ...withRules(result),
    });
  } catch (error) {
    if (typeof error.code === "number" || error.code === "RATE_LIMIT") {
      const status = error.code === "RATE_LIMIT" ? 429 : error.code;
      return res.status(typeof status === "number" ? status : 503).json({
        success: false,
        message: error.message,
      });
    }
    return sendChatError(res, error);
  }
});
