import { z } from "zod";
import { loadTenantContext } from "../../../../lib/tenant-context.js";
import { ensureProvider } from "../../llm/provider.js";
import { composeTriagePrompt } from "../../prompt/compose.js";
import { triageSchema } from "../../extraction/triage-schema.js";
import { modelForStep } from "../../llm/section-cache.js";
import { normalizeDocumentKind } from "../../storage/allowed.js";

const triageResponseSchema = z.object({
  detectedType: z.string().nullable(),
  documentDate: z.string().nullable(),
  signed: z.boolean().nullable(),
  relatedContractRecordId: z.string().uuid().nullable(),
  relevantSections: z.array(z.string()),
});

/**
 * @param {{ tenantId: string, payload: { documentId?: string } }} job
 */
export async function handleTriageDocument(job) {
  const documentId = job.payload?.documentId;
  if (!documentId) throw new Error("TRIAGE_DOCUMENT payload missing documentId.");

  const { db } = await loadTenantContext(job.tenantId);
  const document = await db.document.findUnique({
    where: { id: documentId },
    include: { pages: { orderBy: { pageNumber: "asc" }, take: 30 } },
  });
  if (!document || document.status !== "READY") return;
  if (document.triagedAt) return;

  const prompt = composeTriagePrompt({});
  const userContent = [
    `Triage document: ${document.originalFilename}`,
    document.pages.map((p) => `\n[page ${p.pageNumber}]\n${p.text}`).join("\n"),
  ].join("\n");

  const provider = await ensureProvider();
  const result = await provider.extract({
    systemPrompt: prompt.content,
    promptHash: prompt.hash,
    userContent,
    schema: triageResponseSchema,
    modelId: modelForStep("triage"),
  });

  const parsed = triageSchema.safeParse(result.data);
  const data = parsed.success
    ? parsed.data
    : {
        detectedType: document.documentType,
        documentDate: null,
        signed: null,
        relatedContractRecordId: null,
        relevantSections: [],
      };
  data.detectedType =
    normalizeDocumentKind(data.detectedType) ||
    normalizeDocumentKind(document.documentType) ||
    "OTHER";

  await db.document.update({
    where: { id: documentId },
    data: {
      detectedType: data.detectedType,
      documentDate: data.documentDate,
      signed: data.signed,
      relatedContractRecordId: data.relatedContractRecordId,
      relevantSections: data.relevantSections,
      triagedAt: new Date(),
    },
  });
}

export async function onTriageDocumentDead(job, errorMessage) {
  const documentId = job.payload?.documentId;
  if (!documentId) return;
  const { db } = await loadTenantContext(job.tenantId);
  await db.document.update({
    where: { id: documentId },
    data: {
      failureReason: errorMessage?.slice(0, 2000) ?? "Triage failed.",
    },
  });
}
