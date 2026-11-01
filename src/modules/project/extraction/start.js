import {
  enqueueExtractorJob,
  getLeadExtractor,
} from "./fanout.js";
import { getExtractorSections, getEnabledSections } from "../sections/registry.js";
import { pipelineDocumentWhere } from "../extraction/corpus.js";
import { isSectionEnabled } from "../access/section-modules.js";

/**
 * Create an ExtractionRun and one SectionExtraction per enabled section.
 * Only sections whose client module is switched on are created.
 * Only the lead extractor (contract) is queued immediately so the UI can
 * show a draft as soon as it lands. Remaining extractors are queued after
 * the lead job finishes (see fanout.js). Chronology waits until all
 * extractors are terminal.
 *
 * @param {{ db: object, projectId: string, tenantId: string, enabledModules: Set<string> }} params
 */
export async function startExtractionRun({ db, projectId, tenantId, enabledModules }) {
  const readyCount = await db.document.count({
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

  const active = await db.extractionRun.findFirst({
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

  const sections = getEnabledSections().filter((section) =>
    isSectionEnabled(section.key, enabledModules)
  );
  const extractorKeys = new Set(getExtractorSections().map((s) => s.key));
  const lead = getLeadExtractor(sections.map((s) => s.key));

  if (!lead || !sections.some((s) => extractorKeys.has(s.key))) {
    throw Object.assign(
      new Error(
        "No extraction modules (contract, genotype, phase, protocol) are enabled for this client."
      ),
      { code: 400 }
    );
  }

  const { run, leadRow } = await db.$transaction(async (tx) => {
    const created = await tx.extractionRun.create({
      data: {
        projectId,
        status: "QUEUED",
        provider: (process.env.NUBRED_LLM_PROVIDER ?? "gemini").trim().toLowerCase(),
        inputTokens: 0,
        outputTokens: 0,
      },
    });

    let row = null;
    for (const section of sections) {
      const sectionRow = await tx.sectionExtraction.create({
        data: {
          extractionRunId: created.id,
          projectId,
          sectionKey: section.key,
          status: "QUEUED",
        },
      });
      if (section.key === lead.key) row = sectionRow;
    }

    if (!row) {
      throw new Error(`Lead extractor "${lead.key}" row was not created.`);
    }
    return { run: created, leadRow: row };
  });

  // Jobs live in the platform database: enqueue after the tenant rows commit.
  try {
    await enqueueExtractorJob({
      tenantId,
      projectId,
      extractionRunId: run.id,
      sectionExtractionId: leadRow.id,
      sectionKey: lead.key,
    });
  } catch (error) {
    await db.extractionRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: "Could not queue the extraction job." },
    });
    throw error;
  }

  return db.extractionRun.findUnique({
    where: { id: run.id },
    include: { sections: { orderBy: { createdAt: "asc" } } },
  });
}
