import { loadTenantContext } from "../../../../lib/tenant-context.js";
import { runDeriveSections } from "../../extraction/derive-engine.js";
import { runFailureSummary, userFacingStepError } from "../../extraction/failure-message.js";

export async function handleDeriveSections(job) {
  const extractionRunId = job.payload?.extractionRunId;
  if (!extractionRunId) {
    throw new Error("DERIVE_SECTIONS payload missing extractionRunId.");
  }

  const { db } = await loadTenantContext(job.tenantId);
  const run = await db.extractionRun.findUnique({ where: { id: extractionRunId } });
  if (!run || run.completedAt) return;

  await runDeriveSections(db, run.projectId);

  const steps = await db.extractionStep.findMany({
    where: { extractionRunId },
    select: { documentId: true, sectionKey: true, status: true, error: true },
  });
  const failedSteps = steps.filter((step) => step.status === "FAILED");
  const failedDocumentIds = new Set(
    failedSteps.map((step) => step.documentId).filter(Boolean)
  );
  const documentIds = Array.isArray(run.documentIds) ? run.documentIds : [];
  const processedIds = documentIds.filter((id) => !failedDocumentIds.has(id));
  if (processedIds.length) {
    await db.document.updateMany({
      where: { id: { in: processedIds }, projectId: run.projectId },
      data: { processedAt: new Date() },
    });
  }

  await db.extractionRun.update({
    where: { id: extractionRunId },
    data: {
      status: failedSteps.length > 0 ? "PARTIAL" : "SUCCEEDED",
      error: runFailureSummary(failedSteps),
      completedAt: new Date(),
    },
  });

  const extracting = await db.sectionState.findMany({
    where: { projectId: run.projectId, status: "EXTRACTING" },
    select: { sectionKey: true },
  });
  for (const state of extracting) {
    const stored = await db.fieldValue.count({
      where: {
        record: { projectId: run.projectId, sectionKey: state.sectionKey, deletedAt: null },
      },
    });
    await db.sectionState.update({
      where: {
        projectId_sectionKey: { projectId: run.projectId, sectionKey: state.sectionKey },
      },
      data: { status: stored > 0 ? "TO_REVIEW" : "NOT_STARTED" },
    });
  }
}

export async function onDeriveSectionsDead(job, errorMessage) {
  const extractionRunId = job.payload?.extractionRunId;
  if (!extractionRunId) return;
  const { db } = await loadTenantContext(job.tenantId);
  await db.extractionRun.update({
    where: { id: extractionRunId },
    data: {
      status: "FAILED",
      error: userFacingStepError(errorMessage) ?? errorMessage?.slice(0, 4000),
      completedAt: new Date(),
    },
  });
}