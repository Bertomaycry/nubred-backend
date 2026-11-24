import { pipelineDocumentWhere } from "./corpus.js";
import { planExtractionSteps } from "./plan-run.js";
import { documentUnprocessed, sortDocumentsForPipeline } from "./document-order.js";
import { advanceExtractionRun, enqueueDeriveSections } from "./chain.js";
import { enabledSectionKeys } from "../access/section-modules.js";
import { sectionDependents } from "../sections/dependents.js";

/**
 * Create an ExtractionRun + ExtractionStep chain (v2).
 */
export async function startExtractionRun({
  db,
  projectId,
  tenantId,
  enabledModules,
  scope = "full",
  sectionKey = null,
  cascade = false,
}) {
  const documents = await db.document.findMany({
    where: {
      ...pipelineDocumentWhere(projectId),
      ...(scope === "full" ? { processedAt: null } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  const runnable =
    scope === "full"
      ? documents.filter(documentUnprocessed)
      : documents;

  if (runnable.length === 0) {
    throw Object.assign(
      new Error("No unprocessed READY documents available for extraction."),
      { code: 400 }
    );
  }

  const active = await db.extractionRun.findFirst({
    where: {
      projectId,
      status: { in: ["QUEUED", "RUNNING"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (active) {
    await resumeStalledRun({ db, tenantId, projectId, run: active });
    throw Object.assign(
      new Error("An extraction run is already in progress for this project."),
      { code: 409, extractionRun: active }
    );
  }

  const sorted = sortDocumentsForPipeline(runnable);
  const documentIds = sorted.map((d) => d.id);

  const relevantByDoc = new Map(
    sorted.map((d) => [
      d.id,
      Array.isArray(d.relevantSections) ? d.relevantSections : [],
    ])
  );

  let steps = planExtractionSteps({
    documentIds,
    enabledModules,
    relevantByDoc,
  });

  if (scope.startsWith("section:")) {
    const key = sectionKey || scope.replace("section:", "");
    const order = cascade
      ? [key, ...sectionDependents(key, enabledSectionKeys(enabledModules))]
      : [key];
    if (!steps.some((s) => s.sectionKey === key)) {
      throw Object.assign(
        new Error(`No extraction steps planned for section "${key}".`),
        { code: 400 }
      );
    }
    steps = steps
      .filter((s) => order.includes(s.sectionKey))
      .sort((a, b) => order.indexOf(a.sectionKey) - order.indexOf(b.sectionKey));
  }

  if (!enabledSectionKeys(enabledModules).some((k) => steps.some((s) => s.sectionKey === k))) {
    throw Object.assign(
      new Error("No enabled sections to extract for this client."),
      { code: 400 }
    );
  }

  const run = await db.$transaction(async (tx) => {
    const created = await tx.extractionRun.create({
      data: {
        projectId,
        status: "QUEUED",
        scope,
        documentIds,
        stepsTotal: steps.length,
        stepsDone: 0,
        provider: (process.env.NUBRED_LLM_PROVIDER ?? "gemini").trim().toLowerCase(),
        inputTokens: 0,
        outputTokens: 0,
      },
    });

    // The chain runs steps by createdAt; one ms apart keeps the planned order.
    const base = Date.now();
    for (const [index, step] of steps.entries()) {
      await tx.extractionStep.create({
        data: {
          extractionRunId: created.id,
          projectId,
          documentId: step.documentId,
          sectionKey: step.sectionKey,
          partIndex: step.partIndex,
          status: "QUEUED",
          createdAt: new Date(base + index),
        },
      });
    }

    return created;
  });

  await advanceExtractionRun({
    db,
    tenantId,
    projectId,
    extractionRunId: run.id,
  });

  return db.extractionRun.findUnique({
    where: { id: run.id },
    include: { steps: { orderBy: { createdAt: "asc" } } },
  });
}

/**
 * A dead extract step used to stop the chain and leave the run RUNNING.
 * Resume it when the user starts extraction again.
 */
async function resumeStalledRun({ db, tenantId, projectId, run }) {
  const open = await db.extractionStep.count({
    where: { extractionRunId: run.id, status: { in: ["QUEUED", "RUNNING"] } },
  });
  if (open === 0) {
    await enqueueDeriveSections({
      tenantId,
      projectId,
      extractionRunId: run.id,
    });
    return;
  }

  const running = await db.extractionStep.count({
    where: { extractionRunId: run.id, status: "RUNNING" },
  });
  if (running === 0) {
    await advanceExtractionRun({
      db,
      tenantId,
      projectId,
      extractionRunId: run.id,
    });
  }
}