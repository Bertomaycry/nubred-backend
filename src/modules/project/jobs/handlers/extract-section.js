import prisma from "../../../../lib/prisma.js";
import { composeSystemPrompt } from "../../prompt/compose.js";
import { ensureProvider } from "../../llm/provider.js";
import { getSection } from "../../sections/registry.js";
import { assembleCorpus, pipelineDocumentWhere } from "../../extraction/corpus.js";
import { buildFieldMeta, persistEvidence } from "../../extraction/evidence.js";
import { accumulateRunUsage, maybeEnqueueChronology } from "../../extraction/finalize.js";
import { enqueueRemainingExtractors } from "../../extraction/fanout.js";

/**
 * EXTRACT_SECTION — LLM structured extraction for one extractor section.
 *
 * @param {{ payload: { extractionRunId?: string, sectionExtractionId?: string, sectionKey?: string }, tenantId?: string, projectId?: string }} job
 */
export async function handleExtractSection(job) {
  const { extractionRunId, sectionExtractionId, sectionKey } = job.payload ?? {};
  if (!extractionRunId || !sectionExtractionId || !sectionKey) {
    throw new Error("EXTRACT_SECTION payload is missing extractionRunId, sectionExtractionId, or sectionKey.");
  }

  const section = getSection(sectionKey);
  if (section.kind !== "extractor") {
    throw new Error(`Section "${sectionKey}" is not an extractor.`);
  }

  const row = await prisma.sectionExtraction.findUnique({
    where: { id: sectionExtractionId },
  });
  if (!row) return;
  if (row.status === "SUCCEEDED") return;

  const run = await prisma.extractionRun.findUnique({
    where: { id: extractionRunId },
  });
  if (!run) return;

  await prisma.sectionExtraction.update({
    where: { id: sectionExtractionId },
    data: { status: "RUNNING", error: null },
  });

  const documents = await prisma.document.findMany({
    where: pipelineDocumentWhere(run.projectId),
    include: { pages: { orderBy: { pageNumber: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  if (documents.length === 0) {
    throw new Error("No READY documents available for extraction.");
  }

  const corpus = assembleCorpus(documents, section.relevantDocTypes ?? []);
  if (!corpus.text) {
    throw new Error("READY documents have no extracted page text.");
  }

  const prompt = composeSystemPrompt(section.promptDir);
  const userContent = [
    `Extract the "${section.label}" section for this project.`,
    "Cite document_name exactly as labelled after ### and page numbers from [page N].",
    corpus.truncated
      ? "NOTE: Document text was truncated to fit the context window. Prefer primary sources listed first."
      : "",
    corpus.text,
  ]
    .filter(Boolean)
    .join("\n\n");

  const provider = await ensureProvider();
  const result = await provider.extract({
    systemPrompt: prompt.content,
    promptHash: prompt.hash,
    userContent,
    schema: section.schema,
  });

  const parsed = section.schema.safeParse(result.data);
  const payload = parsed.success ? parsed.data : null;
  const evidence = Array.isArray(payload?.evidence)
    ? payload.evidence
    : Array.isArray(result.data?.evidence)
      ? result.data.evidence
      : [];

  await prisma.$transaction(async (tx) => {
    await persistEvidence(tx, {
      projectId: run.projectId,
      sectionExtractionId,
      sectionKey,
      evidence,
      documents,
    });

    await tx.sectionExtraction.update({
      where: { id: sectionExtractionId },
      data: {
        status: parsed.success ? "SUCCEEDED" : "FAILED",
        promptHash: result.promptHash ?? prompt.hash,
        modelId: result.modelId ?? null,
        rawResponse: result.data ?? null,
        payload,
        fieldMeta: payload ? buildFieldMeta(payload, evidence) : null,
        error: parsed.success
          ? null
          : `Schema validation failed: ${parsed.error.message}`.slice(0, 4000),
      },
    });
  });

  await accumulateRunUsage(extractionRunId, {
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens: result.usage?.outputTokens ?? 0,
    modelId: result.modelId,
    promptHash: result.promptHash ?? prompt.hash,
  });

  if (!parsed.success) {
    console.error(
      `Section "${sectionKey}" schema validation failed: ${parsed.error.message}`
    );
  }

  const projectId = job.projectId ?? run.projectId;
  await enqueueRemainingExtractors({
    extractionRunId,
    tenantId: job.tenantId,
    projectId,
    completedSectionKey: sectionKey,
  });

  await maybeEnqueueChronology(extractionRunId, job.tenantId, projectId);
}

/**
 * @param {{ payload: { sectionExtractionId?: string, extractionRunId?: string }, tenantId?: string, projectId?: string }} job
 * @param {string} errorMessage
 */
export async function onExtractSectionDead(job, errorMessage) {
  const { sectionExtractionId, extractionRunId } = job.payload ?? {};
  if (sectionExtractionId) {
    try {
      await prisma.sectionExtraction.update({
        where: { id: sectionExtractionId },
        data: {
          status: "FAILED",
          error: errorMessage || "Section extraction failed after retries.",
        },
      });
    } catch (error) {
      if (error?.code !== "P2025") throw error;
    }
  }

  if (extractionRunId) {
    await enqueueRemainingExtractors({
      extractionRunId,
      tenantId: job.tenantId,
      projectId: job.projectId,
      completedSectionKey: job.payload?.sectionKey,
    });
    await maybeEnqueueChronology(
      extractionRunId,
      job.tenantId,
      job.projectId
    );
  }
}
