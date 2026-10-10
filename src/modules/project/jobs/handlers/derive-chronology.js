import prisma from "../../../../lib/prisma.js";
import { deriveChronology } from "../../extraction/derive-chronology.js";
import { buildFieldMeta, persistEvidence } from "../../extraction/evidence.js";
import { finalizeRun } from "../../extraction/finalize.js";
import { pipelineDocumentWhere } from "../../extraction/corpus.js";

/**
 * DERIVE_CHRONOLOGY — no LLM. Aggregates dated facts from extractor payloads.
 *
 * @param {{ payload: { extractionRunId?: string, sectionExtractionId?: string } }} job
 */
export async function handleDeriveChronology(job) {
  const { extractionRunId, sectionExtractionId } = job.payload ?? {};
  if (!extractionRunId || !sectionExtractionId) {
    throw new Error("DERIVE_CHRONOLOGY payload is missing extractionRunId or sectionExtractionId.");
  }

  const row = await prisma.sectionExtraction.findUnique({
    where: { id: sectionExtractionId },
  });
  if (!row) return;
  if (row.status === "SUCCEEDED") {
    await prisma.$transaction((tx) => finalizeRun(tx, extractionRunId));
    return;
  }

  await prisma.sectionExtraction.update({
    where: { id: sectionExtractionId },
    data: { status: "RUNNING", error: null },
  });

  const siblings = await prisma.sectionExtraction.findMany({
    where: {
      extractionRunId,
      sectionKey: { in: ["contract", "genotype", "phase", "protocol"] },
      status: "SUCCEEDED",
    },
  });

  const payloadsBySection = {};
  for (const sibling of siblings) {
    payloadsBySection[sibling.sectionKey] = sibling.payload;
  }

  const documents = await prisma.document.findMany({
    where: pipelineDocumentWhere(row.projectId),
    select: {
      id: true,
      originalFilename: true,
      documentType: true,
      uploadedAt: true,
    },
  });

  const payload = deriveChronology(payloadsBySection, documents);
  const evidence = Array.isArray(payload.evidence) ? payload.evidence : [];

  await prisma.$transaction(async (tx) => {
    await persistEvidence(tx, {
      projectId: row.projectId,
      sectionExtractionId,
      sectionKey: "chronology",
      evidence,
      documents,
    });

    await tx.sectionExtraction.update({
      where: { id: sectionExtractionId },
      data: {
        status: "SUCCEEDED",
        promptHash: null,
        modelId: "deriver",
        rawResponse: payload,
        payload,
        fieldMeta: buildFieldMeta(payload, evidence),
        error: null,
      },
    });

    await finalizeRun(tx, extractionRunId);
  });
}

/**
 * @param {{ payload: { sectionExtractionId?: string, extractionRunId?: string } }} job
 * @param {string} errorMessage
 */
export async function onDeriveChronologyDead(job, errorMessage) {
  const { sectionExtractionId, extractionRunId } = job.payload ?? {};
  if (sectionExtractionId) {
    try {
      await prisma.sectionExtraction.update({
        where: { id: sectionExtractionId },
        data: {
          status: "FAILED",
          error: errorMessage || "Chronology derivation failed after retries.",
        },
      });
    } catch (error) {
      if (error?.code !== "P2025") throw error;
    }
  }
  if (extractionRunId) {
    await prisma.$transaction((tx) => finalizeRun(tx, extractionRunId));
  }
}
