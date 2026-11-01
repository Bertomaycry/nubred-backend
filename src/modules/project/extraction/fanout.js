import prisma from "../../../lib/prisma.js";
import { enqueueJob } from "../jobs/enqueue.js";
import { JOB_TYPES } from "../jobs/types.js";
import { getExtractorSections } from "../sections/registry.js";

const EXTRACT_MAX_ATTEMPTS = 6;

/**
 * First extractor (by confirmation order) among the given section keys.
 * Defaults to every registered extractor (contract first). When a client has
 * some modules switched off, pass the section keys that exist in the run.
 * That section is the only LLM job queued at start so the UI can render
 * a draft as soon as it finishes; the rest fan out afterwards.
 *
 * @param {string[]} [sectionKeys]
 */
export function getLeadExtractor(sectionKeys) {
  const extractors = getExtractorSections().filter(
    (s) => !sectionKeys || sectionKeys.includes(s.key)
  );
  return extractors[0] ?? null;
}

/**
 * Jobs live in the platform database, so the platform client is used even
 * though the section rows are in the tenant database.
 *
 * @param {object} params
 */
export async function enqueueExtractorJob({
  tenantId,
  projectId,
  extractionRunId,
  sectionExtractionId,
  sectionKey,
}) {
  return enqueueJob({
    type: JOB_TYPES.EXTRACT_SECTION,
    tenantId,
    projectId,
    payload: { extractionRunId, sectionExtractionId, sectionKey },
    maxAttempts: EXTRACT_MAX_ATTEMPTS,
  });
}

/**
 * After the lead extractor is terminal, queue the remaining EXTRACT_SECTION
 * jobs. Idempotent — skips sectionExtractionIds that already have a job.
 *
 * @param {{
 *   db: object,
 *   extractionRunId: string,
 *   tenantId: string,
 *   projectId?: string,
 *   completedSectionKey?: string,
 * }} params
 */
export async function enqueueRemainingExtractors({
  db,
  extractionRunId,
  tenantId,
  projectId,
  completedSectionKey,
}) {
  const runRows = await db.sectionExtraction.findMany({
    where: { extractionRunId },
  });

  const extractorKeys = new Set(getExtractorSections().map((s) => s.key));
  const lead = getLeadExtractor(runRows.map((row) => row.sectionKey));
  if (!lead || completedSectionKey !== lead.key) return;

  const rows = runRows.filter(
    (row) => row.sectionKey !== lead.key && extractorKeys.has(row.sectionKey)
  );
  if (rows.length === 0) return;

  const existing = await prisma.job.findMany({
    where: {
      tenantId,
      type: JOB_TYPES.EXTRACT_SECTION,
      payload: {
        path: ["extractionRunId"],
        equals: extractionRunId,
      },
    },
    select: { payload: true },
  });
  const alreadyQueued = new Set(
    existing.map((job) => job.payload?.sectionExtractionId).filter(Boolean)
  );

  for (const row of rows) {
    if (alreadyQueued.has(row.id)) continue;
    if (row.status !== "QUEUED") continue;
    await enqueueExtractorJob({
      tenantId,
      projectId,
      extractionRunId,
      sectionExtractionId: row.id,
      sectionKey: row.sectionKey,
    });
  }
}
