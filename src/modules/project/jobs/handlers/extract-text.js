import { createHash } from "node:crypto";
import prisma from "../../../../lib/prisma.js";
import { ensureStorage } from "../../storage/provider.js";
import { extractDocumentText } from "../../ingestion/extract-text.js";

/**
 * EXTRACT_TEXT — download the blob, extract per-page text, mark Document READY.
 *
 * Idempotent: if the document is already READY or has been deleted, the job
 * completes without re-extracting.
 *
 * @param {{ payload: { documentId?: string } }} job
 */
export async function handleExtractText(job) {
  const documentId = job.payload?.documentId;
  if (!documentId) {
    throw new Error("EXTRACT_TEXT payload is missing documentId.");
  }

  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) {
    return;
  }
  if (document.status === "READY") {
    return;
  }
  if (document.status === "PENDING_UPLOAD") {
    throw new Error(
      `Document ${documentId} is still PENDING_UPLOAD; object may not be in storage yet.`
    );
  }

  const storage = await ensureStorage();
  const buffer = await storage.getObjectBuffer(document.storageKey);
  const digest = createHash("sha256").update(buffer).digest("hex");
  const { pages } = await extractDocumentText(buffer, document.mimeType);

  await prisma.$transaction(async (tx) => {
    await tx.documentPage.deleteMany({ where: { documentId } });
    if (pages.length > 0) {
      await tx.documentPage.createMany({
        data: pages.map((page) => ({
          documentId,
          pageNumber: page.pageNumber,
          text: page.text,
          charCount: page.charCount,
        })),
      });
    }
    await tx.document.update({
      where: { id: documentId },
      data: {
        status: "READY",
        failureReason: null,
        checksumSha256: document.checksumSha256 || digest,
      },
    });
  });
}

/**
 * After retries are exhausted, surface the failure on the document so the
 * frontend poll (GET document) can stop on FAILED.
 *
 * @param {{ payload: { documentId?: string } }} job
 * @param {string} errorMessage
 */
export async function onExtractTextDead(job, errorMessage) {
  const documentId = job.payload?.documentId;
  if (!documentId) return;

  try {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "FAILED",
        failureReason: errorMessage || "Text extraction failed after retries.",
      },
    });
  } catch (error) {
    if (error?.code === "P2025") return;
    throw error;
  }
}
