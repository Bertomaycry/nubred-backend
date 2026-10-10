import { join } from "node:path";
import prisma from "../../../lib/prisma.js";
import { assembleCorpus, pipelineDocumentWhere } from "../extraction/corpus.js";
import { composeChatSystemPrompt } from "../prompt/compose.js";
import { getEnabledSections } from "../sections/registry.js";
import { getLatestSectionRow, requireSectionKey } from "../review/load.js";
import { DOWNSTREAM_WARNING } from "./intents.js";

export const CHAT_CORPUS_MAX_CHARS = 80_000;
export const PAYLOAD_CONTEXT_MAX_CHARS = 16_000;

export async function loadChatContext({
  projectId,
  sectionKey,
  fieldPath,
  documentIds,
}) {
  const section = requireSectionKey(sectionKey);
  const row = await getLatestSectionRow(projectId, sectionKey);

  const pipelineDocs = await prisma.document.findMany({
    where: pipelineDocumentWhere(projectId),
    include: { pages: { orderBy: { pageNumber: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  const chatbotDocs = await prisma.document.findMany({
    where: {
      projectId,
      status: "READY",
      origin: "CHATBOT",
      sectionKey,
    },
    include: { pages: { orderBy: { pageNumber: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  let scopedDocs = [];
  if (Array.isArray(documentIds) && documentIds.length > 0) {
    scopedDocs = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        projectId,
      },
      include: { pages: { orderBy: { pageNumber: "asc" } } },
    });
    if (scopedDocs.length !== documentIds.length) {
      throw Object.assign(
        new Error("One or more documentIds do not belong to this project."),
        { code: 400 }
      );
    }
    const notReady = scopedDocs.filter((doc) => doc.status !== "READY");
    if (notReady.length) {
      throw Object.assign(
        new Error(
          "Chatbot documents must finish text extraction (status READY) before they can be used in chat. Poll GET .../documents/:id."
        ),
        { code: 409 }
      );
    }
    const wrongScope = scopedDocs.filter(
      (doc) => doc.origin !== "CHATBOT" || doc.sectionKey !== sectionKey
    );
    if (wrongScope.length) {
      throw Object.assign(
        new Error(
          "Chat attachments must be uploaded with origin CHATBOT for this sectionKey. " +
            "Use init-upload with origin: \"CHATBOT\" and sectionKey set to the active section."
        ),
        { code: 400 }
      );
    }
  }

  const evidence = fieldPath && row
    ? await prisma.evidenceItem.findMany({
        where: {
          projectId,
          sectionKey,
          OR: [
            { fieldPath },
            { fieldPath: { startsWith: `${fieldPath}.` } },
            { fieldPath: { startsWith: `${fieldPath}[` } },
          ],
        },
        orderBy: { createdAt: "asc" },
      })
    : row
      ? await prisma.evidenceItem.findMany({
          where: { sectionExtractionId: row.id },
          orderBy: { fieldPath: "asc" },
          take: 80,
        })
      : [];

  return {
    section,
    row,
    pipelineDocs,
    chatbotDocs,
    scopedDocs,
    evidence,
    systemPrompt: composeChatSystemPrompt(join(section.promptDir, "00-role.md")),
  };
}

export function buildCorpusText(documents, relevantDocTypes) {
  return assembleCorpus(documents, relevantDocTypes ?? [], {
    maxChars: CHAT_CORPUS_MAX_CHARS,
  });
}

export function compactPayload(payload) {
  if (payload == null) return "(no draft payload yet)";
  const json = JSON.stringify(payload, null, 2);
  if (json.length <= PAYLOAD_CONTEXT_MAX_CHARS) return json;
  return `${json.slice(0, PAYLOAD_CONTEXT_MAX_CHARS)}\n… [truncated]`;
}

export function formatEvidence(evidence) {
  if (!evidence?.length) return "(no stored citations)";
  return evidence
    .map(
      (item) =>
        `- ${item.fieldPath} ← ${item.documentName}` +
        `${item.page != null ? ` p.${item.page}` : ""}: "${item.quote}"`
    )
    .join("\n");
}

export async function downstreamWarning(projectId, sectionKey) {
  const current = requireSectionKey(sectionKey);
  const later = getEnabledSections().filter((section) => section.order > current.order);
  if (later.length === 0) return null;

  const confirmations = await prisma.sectionConfirmation.findMany({
    where: {
      projectId,
      sectionKey: { in: later.map((section) => section.key) },
    },
    select: { sectionKey: true },
  });
  const confirmed = new Set(confirmations.map((row) => row.sectionKey));
  if (later.some((section) => !confirmed.has(section.key))) {
    return DOWNSTREAM_WARNING;
  }
  return null;
}

export function mapDocumentName(documents, name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  return (
    documents.find((doc) => doc.originalFilename.toLowerCase() === lower) ?? null
  );
}

export function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-12)
    .map((turn) => ({
      role: turn.role === "model" || turn.role === "assistant" ? "model" : "user",
      content: String(turn.content ?? "").slice(0, 4000),
    }))
    .filter((turn) => turn.content);
}
