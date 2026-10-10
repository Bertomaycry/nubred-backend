import prisma from "../../../lib/prisma.js";
import { enqueueJob } from "../jobs/enqueue.js";
import { JOB_TYPES } from "../jobs/types.js";
import { getExtractorSections } from "../sections/registry.js";

/**
 * After an extractor section finishes, enqueue chronology if every extractor
 * is terminal (SUCCEEDED or FAILED). If all extractors failed, fail the run.
 *
 * @param {string} extractionRunId
 * @param {string} tenantId
 * @param {string} projectId
 */
export async function maybeEnqueueChronology(extractionRunId, tenantId, projectId) {
  const extractorKeys = getExtractorSections().map((s) => s.key);

  await prisma.$transaction(async (tx) => {
    const remaining = await tx.sectionExtraction.count({
      where: {
        extractionRunId,
        sectionKey: { in: extractorKeys },
        status: { in: ["QUEUED", "RUNNING"] },
      },
    });
    if (remaining > 0) return;

    const chronology = await tx.sectionExtraction.findFirst({
      where: { extractionRunId, sectionKey: "chronology" },
    });
    if (!chronology) {
      await finalizeRun(tx, extractionRunId);
      return;
    }
    if (chronology.status !== "QUEUED") return;

    const succeeded = await tx.sectionExtraction.count({
      where: {
        extractionRunId,
        sectionKey: { in: extractorKeys },
        status: "SUCCEEDED",
      },
    });

    if (succeeded === 0) {
      await tx.sectionExtraction.update({
        where: { id: chronology.id },
        data: {
          status: "FAILED",
          error: "All extractor sections failed; chronology was not derived.",
        },
      });
      await finalizeRun(tx, extractionRunId);
      return;
    }

    await enqueueJob(
      {
        type: JOB_TYPES.DERIVE_CHRONOLOGY,
        tenantId,
        projectId,
        payload: {
          extractionRunId,
          sectionExtractionId: chronology.id,
        },
      },
      tx
    );
  });
}

/**
 * Set ExtractionRun status from its section rows. Call when chronology
 * finishes, or when extractors all fail with no chronology job.
 *
 * @param {import("@prisma/client").Prisma.TransactionClient | import("@prisma/client").PrismaClient} tx
 * @param {string} extractionRunId
 */
export async function finalizeRun(tx, extractionRunId) {
  const sections = await tx.sectionExtraction.findMany({
    where: { extractionRunId },
    select: { status: true },
  });

  if (sections.some((s) => s.status === "QUEUED" || s.status === "RUNNING")) {
    return;
  }

  const succeeded = sections.filter((s) => s.status === "SUCCEEDED").length;
  const failed = sections.filter((s) => s.status === "FAILED").length;

  let status = "SUCCEEDED";
  if (succeeded === 0) status = "FAILED";
  else if (failed > 0) status = "PARTIAL";

  await tx.extractionRun.update({
    where: { id: extractionRunId },
    data: {
      status,
      completedAt: new Date(),
    },
  });
}

/**
 * @param {string} extractionRunId
 * @param {{ inputTokens?: number, outputTokens?: number, modelId?: string, promptHash?: string, provider?: string }} usage
 */
export async function accumulateRunUsage(extractionRunId, usage) {
  await prisma.extractionRun.updateMany({
    where: { id: extractionRunId, startedAt: null },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  await prisma.extractionRun.update({
    where: { id: extractionRunId },
    data: {
      status: "RUNNING",
      inputTokens: { increment: usage.inputTokens ?? 0 },
      outputTokens: { increment: usage.outputTokens ?? 0 },
      ...(usage.modelId ? { modelId: usage.modelId } : {}),
      ...(usage.promptHash ? { promptHash: usage.promptHash } : {}),
      ...(usage.provider ? { provider: usage.provider } : {}),
    },
  });
}
