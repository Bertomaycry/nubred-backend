import { asyncHandler } from "../utils/asyncHandler.js";
import { startExtractionRun } from "../modules/project/extraction/start.js";
import { loadEnabledModules } from "../middlewares/tenant.middleware.js";
import { userFacingStepError } from "../modules/project/extraction/failure-message.js";

function serializeStep(step) {
  return {
    id: step.id,
    documentId: step.documentId,
    sectionKey: step.sectionKey,
    partIndex: step.partIndex,
    status: step.status,
    skipReason: step.skipReason,
    modelId: step.modelId,
    inputTokens: step.inputTokens,
    outputTokens: step.outputTokens,
    durationMs: step.durationMs,
    error: userFacingStepError(step.error),
    createdAt: step.createdAt,
    updatedAt: step.updatedAt,
  };
}

function serializeRun(run, { includeSteps = false } = {}) {
  return {
    id: run.id,
    projectId: run.projectId,
    status: run.status,
    scope: run.scope,
    documentIds: run.documentIds,
    currentDocumentId: run.currentDocumentId,
    currentSectionKey: run.currentSectionKey,
    stepsDone: run.stepsDone,
    stepsTotal: run.stepsTotal,
    promptHash: run.promptHash,
    modelId: run.modelId,
    provider: run.provider,
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    error: run.error,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    steps: includeSteps ? (run.steps ?? []).map(serializeStep) : undefined,
  };
}

export const startExtraction = asyncHandler(async (req, res) => {
  try {
    const run = await startExtractionRun({
      db: req.db,
      projectId: req.project.id,
      tenantId: req.tenant.id,
      enabledModules: await loadEnabledModules(req.tenant.id),
      scope: "full",
    });
    res.status(202).json({
      success: true,
      message: "Extraction queued. Poll GET .../extractions/latest for progress.",
      extraction: serializeRun(run, { includeSteps: true }),
    });
  } catch (error) {
    if (error.code === 409) {
      return res.status(409).json({
        success: false,
        message: error.message,
        extraction: error.extractionRun
          ? serializeRun(error.extractionRun)
          : undefined,
      });
    }
    if (error.code === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    throw error;
  }
});

export const listExtractions = asyncHandler(async (req, res) => {
  const runs = await req.db.extractionRun.findMany({
    where: { projectId: req.project.id },
    orderBy: { createdAt: "desc" },
    include: { steps: { orderBy: { createdAt: "asc" } } },
  });

  res.status(200).json({
    success: true,
    count: runs.length,
    extractions: runs.map((run) => serializeRun(run, { includeSteps: true })),
  });
});

export const getLatestExtraction = asyncHandler(async (req, res) => {
  const run = await req.db.extractionRun.findFirst({
    where: { projectId: req.project.id },
    orderBy: { createdAt: "desc" },
    include: { steps: { orderBy: { createdAt: "asc" } } },
  });

  if (!run) {
    return res.status(404).json({
      success: false,
      message: "No extraction run found for this project.",
    });
  }

  res.status(200).json({
    success: true,
    extraction: serializeRun(run, { includeSteps: true }),
  });
});

export const getExtraction = asyncHandler(async (req, res) => {
  const run = await req.db.extractionRun.findFirst({
    where: {
      id: req.params.extractionRunId,
      projectId: req.project.id,
    },
    include: { steps: { orderBy: { createdAt: "asc" } } },
  });

  if (!run) {
    return res.status(404).json({
      success: false,
      message: "Extraction run not found.",
    });
  }

  res.status(200).json({
    success: true,
    extraction: serializeRun(run, { includeSteps: true }),
  });
});