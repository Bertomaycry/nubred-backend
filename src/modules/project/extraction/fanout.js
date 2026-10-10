import prisma from "../../../lib/prisma.js";
import { enqueueJob } from "../jobs/enqueue.js";
import { JOB_TYPES } from "../jobs/types.js";
import { getExtractorSections } from "../sections/registry.js";

const EXTRACT_MAX_ATTEMPTS = 6;

/**
 * First enabled extractor by confirmation order (contract).
 * That section is the only LLM job queued at start so the UI can render
 * a draft as soon as it finishes; the rest fan out afterwards.
 */
export function getLeadExtractor() {
  return getExtractorSections()[0] ?? null;
}

/**
 * @param {object} params
 * @param {import("@prisma/client").Prisma.TransactionClient | import("@prisma/client").PrismaClient} [tx]
 */
export async function enqueueExtractorJob(
  { tenantId, projectId, extractionRunId, sectionExtractionId, sectionKey },
  tx = prisma
) {
  return enqueueJob(
    {
      type: JOB_TYPES.EXTRACT_SECTION,
      tenantId,
      projectId,
      payload: { extractionRunId, sectionExtractionId, sectionKey },
      maxAttempts: EXTRACT_MAX_ATTEMPTS,
    },
    tx
  );
}

/**
 * After the lead extractor is terminal, queue the remaining EXTRACT_SECTION
 * jobs. Idempotent — skips sectionExtractionIds that already have a job.
 *
 * @param {{
 *   extractionRunId: string,
 *   tenantId?: string,
 *   projectId?: string,
 *   completedSectionKey?: string,
 * }} params
 */
export async function enqueueRemainingExtractors({
  extractionRunId,
  tenantId,
  projectId,
  completedSectionKey,
}) {
  const lead = getLeadExtractor();
  if (!lead || completedSectionKey !== lead.key) return;

  const extractors = getExtractorSections().filter((s) => s.key !== lead.key);
  if (extractors.length === 0) return;

  await prisma.$transaction(async (tx) => {
    const rows = await tx.sectionExtraction.findMany({
      where: {
        extractionRunId,
        sectionKey: { in: extractors.map((s) => s.key) },
      },
    });

    const existing = await tx.job.findMany({
      where: {
        type: JOB_TYPES.EXTRACT_SECTION,
        payload: {
          path: ["extractionRunId"],
          equals: extractionRunId,
        },
      },
      select: { payload: true },
    });
    const alreadyQueued = new Set(
      existing
        .map((job) => job.payload?.sectionExtractionId)
        .filter(Boolean)
    );

    for (const row of rows) {
      if (alreadyQueued.has(row.id)) continue;
      if (row.status !== "QUEUED") continue;
      await enqueueExtractorJob(
        {
          tenantId,
          projectId,
          extractionRunId,
          sectionExtractionId: row.id,
          sectionKey: row.sectionKey,
        },
        tx
      );
    }
  });
}
