import { asyncHandler } from "../utils/asyncHandler.js";
import prisma from "../lib/prisma.js";
import { startExtractionRun } from "../modules/project/extraction/start.js";

function serializeSection(section, { includePayload = false } = {}) {
  return {
    id: section.id,
    sectionKey: section.sectionKey,
    status: section.status,
    promptHash: section.promptHash,
    modelId: section.modelId,
    error: section.error,
    createdAt: section.createdAt,
    updatedAt: section.updatedAt,
    evidenceCount: section._count?.evidenceItems ?? section.evidenceItems?.length,
    payload: includePayload ? section.payload : undefined,
    fieldMeta: includePayload ? section.fieldMeta : undefined,
    reviewState: includePayload ? section.reviewState ?? {} : undefined,
  };
}

function serializeRun(run, { includePayload = false } = {}) {
  return {
    id: run.id,
    projectId: run.projectId,
    status: run.status,
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
    sections: (run.sections ?? []).map((section) =>
      serializeSection(section, { includePayload })
    ),
  };
}

const sectionInclude = {
  orderBy: { createdAt: "asc" },
  include: { _count: { select: { evidenceItems: true } } },
};

const sectionIncludeWithPayload = {
  orderBy: { createdAt: "asc" },
  include: {
    _count: { select: { evidenceItems: true } },
    evidenceItems: {
      orderBy: { fieldPath: "asc" },
    },
  },
};

// @desc    Start AI extraction for all project sections
// @route   POST /api/projects/:projectId/extractions
// @access  Private (VM)
export const startExtraction = asyncHandler(async (req, res) => {
  try {
    const run = await startExtractionRun({
      projectId: req.project.id,
      tenantId: req.tenant.id,
    });
    res.status(202).json({
      success: true,
      message:
        "Extraction queued. Poll GET /api/projects/:projectId/extractions/latest?includePayload=true — render each section as it succeeds.",
      extraction: serializeRun(run),
    });
  } catch (error) {
    if (error.code === 409) {
      return res.status(409).json({
        success: false,
        message: error.message,
        extraction: error.extractionRun
          ? serializeRun({ ...error.extractionRun, sections: [] })
          : undefined,
      });
    }
    if (error.code === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    throw error;
  }
});

// @desc    List extraction runs for a project (newest first)
// @route   GET /api/projects/:projectId/extractions
// @access  Private
export const listExtractions = asyncHandler(async (req, res) => {
  const runs = await prisma.extractionRun.findMany({
    where: { projectId: req.project.id },
    orderBy: { createdAt: "desc" },
    include: { sections: sectionInclude },
  });

  res.status(200).json({
    success: true,
    count: runs.length,
    extractions: runs.map((run) => serializeRun(run)),
  });
});

// @desc    Latest extraction run (for polling after start)
// @route   GET /api/projects/:projectId/extractions/latest
// @access  Private
export const getLatestExtraction = asyncHandler(async (req, res) => {
  const includePayload = req.query.includePayload === "true";
  const run = await prisma.extractionRun.findFirst({
    where: { projectId: req.project.id },
    orderBy: { createdAt: "desc" },
    include: {
      sections: includePayload ? sectionIncludeWithPayload : sectionInclude,
    },
  });

  if (!run) {
    return res.status(404).json({
      success: false,
      message: "No extraction run found for this project.",
    });
  }

  res.status(200).json({
    success: true,
    extraction: serializeRun(run, { includePayload }),
    sections: includePayload
      ? run.sections.map((section) => ({
          ...serializeSection(section, { includePayload: true }),
          evidence: section.evidenceItems,
        }))
      : undefined,
  });
});

// @desc    One extraction run
// @route   GET /api/projects/:projectId/extractions/:extractionRunId
// @access  Private
export const getExtraction = asyncHandler(async (req, res) => {
  const includePayload = req.query.includePayload !== "false";
  const run = await prisma.extractionRun.findFirst({
    where: {
      id: req.params.extractionRunId,
      projectId: req.project.id,
    },
    include: {
      sections: includePayload ? sectionIncludeWithPayload : sectionInclude,
    },
  });

  if (!run) {
    return res.status(404).json({
      success: false,
      message: "Extraction run not found.",
    });
  }

  res.status(200).json({
    success: true,
    extraction: serializeRun(run, { includePayload }),
    sections: includePayload
      ? run.sections.map((section) => ({
          ...serializeSection(section, { includePayload: true }),
          evidence: section.evidenceItems,
        }))
      : undefined,
  });
});
