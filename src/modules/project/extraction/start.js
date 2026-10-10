import prisma from "../../../lib/prisma.js";
import {
  enqueueExtractorJob,
  getLeadExtractor,
} from "./fanout.js";
import { getExtractorSections, getEnabledSections } from "../sections/registry.js";
import { pipelineDocumentWhere } from "../extraction/corpus.js";

/**
 * Create an ExtractionRun and one SectionExtraction per enabled section.
 * Only the lead extractor (contract) is queued immediately so the UI can
 * show a draft as soon as it lands. Remaining extractors are queued after
 * the lead job finishes (see fanout.js). Chronology waits until all
 * extractors are terminal.
 *
 * @param {{ projectId: string, tenantId: string }} params
 */
export async function startExtractionRun({ projectId, tenantId }) {
  const readyCount = await prisma.document.count({
    where: pipelineDocumentWhere(projectId),
  });
  if (readyCount === 0) {
    throw Object.assign(
      new Error(
        "At least one READY document is required before starting AI extraction."
      ),
      { code: 400 }
    );
  }

  const active = await prisma.extractionRun.findFirst({
    where: {
      projectId,
      status: { in: ["QUEUED", "RUNNING"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (active) {
    throw Object.assign(
      new Error("An extraction run is already in progress for this project."),
      { code: 409, extractionRun: active }
    );
  }

  const extractors = getExtractorSections();
  const sections = getEnabledSections();
  const lead = getLeadExtractor();

  if (extractors.length === 0 || !lead) {
    throw Object.assign(
      new Error("No extractor sections are enabled."),
      { code: 500 }
    );
  }

  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.extractionRun.create({
      data: {
        projectId,
        status: "QUEUED",
        provider: (process.env.NUBRED_LLM_PROVIDER ?? "gemini").trim().toLowerCase(),
        inputTokens: 0,
        outputTokens: 0,
      },
    });

    let leadRow = null;
    for (const section of sections) {
      const row = await tx.sectionExtraction.create({
        data: {
          extractionRunId: created.id,
          projectId,
          sectionKey: section.key,
          status: "QUEUED",
        },
      });
      if (section.key === lead.key) leadRow = row;
    }

    if (!leadRow) {
      throw new Error(`Lead extractor "${lead.key}" row was not created.`);
    }

    await enqueueExtractorJob(
      {
        tenantId,
        projectId,
        extractionRunId: created.id,
        sectionExtractionId: leadRow.id,
        sectionKey: lead.key,
      },
      tx
    );

    return created;
  });

  return prisma.extractionRun.findUnique({
    where: { id: run.id },
    include: { sections: { orderBy: { createdAt: "asc" } } },
  });
}
