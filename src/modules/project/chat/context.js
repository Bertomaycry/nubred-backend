import { assembleCorpus, pipelineDocumentWhere } from "../extraction/corpus.js";
import { composeChatSystemPrompt } from "../prompt/compose.js";
import { requireSectionKey, loadSectionEvidence } from "../review/load.js";
import { listSectionRecords } from "../field-store/repository.js";
import { DOWNSTREAM_WARNING } from "./intents.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const CHAT_CORPUS_MAX_CHARS = 80_000;
export const PAYLOAD_CONTEXT_MAX_CHARS = 16_000;

export async function loadChatContext({
  db,
  projectId,
  sectionKey,
  recordId,
  fieldKey,
  documentIds,
}) {
  const section = requireSectionKey(sectionKey);
  const records = await listSectionRecords(db, projectId, sectionKey);
  const row = {
    id: `${projectId}:${sectionKey}`,
    sectionKey,
    status: records.length ? "SUCCEEDED" : "QUEUED",
    payload: records.length
      ? (await import("../field-store/payload.js")).recordsToPayload(records)
      : null,
  };

  const pipelineDocs = await db.document.findMany({
    where: pipelineDocumentWhere(projectId),
    include: { pages: { orderBy: { pageNumber: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  const chatbotDocs = await db.document.findMany({
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
    scopedDocs = await db.document.findMany({
      where: { id: { in: documentIds }, projectId },
      include: { pages: { orderBy: { pageNumber: "asc" } } },
    });
  }

  let evidence = await loadSectionEvidence(db, projectId, sectionKey);
  if (recordId && fieldKey) {
    evidence = evidence.filter(
      (e) => e.recordId === recordId && e.fieldKey === fieldKey
    );
  }

  const rolePath = join(__dirname, "../sections", sectionKey, "prompts", "00-role.md");
  let systemPrompt;
  try {
    systemPrompt = composeChatSystemPrompt(rolePath);
  } catch {
    const corePath = join(__dirname, "../prompt/core-rules.md");
    systemPrompt = composeChatSystemPrompt(corePath);
  }

  return {
    db,
    section,
    row,
    records,
    pipelineDocs,
    chatbotDocs,
    scopedDocs,
    evidence,
    systemPrompt,
  };
}

export function buildCorpusText(documents, relevantDocTypes) {
  return assembleCorpus(documents, relevantDocTypes ?? [], {
    maxChars: CHAT_CORPUS_MAX_CHARS,
  });
}

export function compactPayload(records) {
  const json = JSON.stringify(records, null, 2);
  if (json.length <= PAYLOAD_CONTEXT_MAX_CHARS) return json;
  return `${json.slice(0, PAYLOAD_CONTEXT_MAX_CHARS)}\n… [truncated]`;
}

export async function downstreamWarning(db, projectId, sectionKey) {
  const state = await db.sectionState.findUnique({
    where: { projectId_sectionKey: { projectId, sectionKey } },
  });
  if (!state?.upstreamChangedAt) return null;
  return DOWNSTREAM_WARNING;
}

export function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && typeof m.content === "string")
    .map((m) => ({
      role: m.role === "model" ? "model" : "user",
      content: m.content,
    }))
    .slice(-20);
}

export function mapDocumentName(documents, documentName) {
  const key = String(documentName ?? "").toLowerCase();
  return (documents ?? []).find(
    (d) => d.originalFilename.toLowerCase() === key
  );
}

export function formatEvidence(evidence) {
  return (evidence ?? [])
    .slice(0, 40)
    .map(
      (e) =>
        `- ${e.documentName}${e.page ? ` p.${e.page}` : ""}: ${String(e.quote).slice(0, 200)}`
    )
    .join("\n");
}