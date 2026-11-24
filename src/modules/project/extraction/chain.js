import { enqueueJob } from "../jobs/enqueue.js";
import { JOB_TYPES } from "../jobs/types.js";

export async function enqueueTriageDocument({ tenantId, projectId, documentId }) {
  return enqueueJob({
    type: JOB_TYPES.TRIAGE_DOCUMENT,
    tenantId,
    projectId,
    payload: { documentId },
  });
}

export async function enqueueExtractStep({
  tenantId,
  projectId,
  extractionRunId,
  stepId,
}) {
  return enqueueJob({
    type: JOB_TYPES.EXTRACT_STEP,
    tenantId,
    projectId,
    payload: { extractionRunId, stepId },
  });
}

export async function enqueueDeriveSections({
  tenantId,
  projectId,
  extractionRunId,
}) {
  return enqueueJob({
    type: JOB_TYPES.DERIVE_SECTIONS,
    tenantId,
    projectId,
    payload: { extractionRunId },
  });
}

/**
 * Queue the first pending step on a run, or DERIVE_SECTIONS when done.
 */
export async function advanceExtractionRun({
  db,
  tenantId,
  projectId,
  extractionRunId,
}) {
  const run = await db.extractionRun.findUnique({
    where: { id: extractionRunId },
  });
  if (!run) return;

  const next = await db.extractionStep.findFirst({
    where: { extractionRunId, status: "QUEUED" },
    orderBy: { createdAt: "asc" },
  });

  if (next) {
    await db.extractionRun.update({
      where: { id: extractionRunId },
      data: {
        status: "RUNNING",
        startedAt: run.startedAt ?? new Date(),
        currentDocumentId: next.documentId,
        currentSectionKey: next.sectionKey,
      },
    });
    await enqueueExtractStep({
      tenantId,
      projectId,
      extractionRunId,
      stepId: next.id,
    });
    return;
  }

  const remaining = await db.extractionStep.count({
    where: {
      extractionRunId,
      status: { in: ["QUEUED", "RUNNING"] },
    },
  });

  if (remaining === 0) {
    await enqueueDeriveSections({ tenantId, projectId, extractionRunId });
  }
}