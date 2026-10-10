import { ensureProvider } from "../llm/provider.js";
import { getAtPath } from "../review/path.js";
import { requireSucceededDraft } from "../review/load.js";
import { chatStructuredSchema } from "./schema.js";
import {
  CHAT_INTENTS,
  coerceLlmValue,
  fieldLabelFromPath,
  inferChatIntent,
  isChatIntent,
} from "./intents.js";
import {
  buildCorpusText,
  compactPayload,
  formatEvidence,
  loadChatContext,
  mapDocumentName,
  normalizeHistory,
} from "./context.js";
import {
  appendFieldEvidence,
  applyChatChanges,
  changeCountMessage,
  toChangeCards,
} from "./apply.js";

const EMPTY_STRUCTURED = {
  message: "",
  sources: [],
  options: [],
  changes: [],
  found: false,
  warning: null,
};

/**
 * @param {{
 *   projectId: string,
 *   sectionKey: string,
 *   userId: string,
 *   message?: string,
 *   history?: Array<{ role: string, content: string }>,
 *   intent?: string,
 *   fieldPath?: string,
 *   documentIds?: string[],
 *   value?: unknown,
 * }} input
 */
export async function runSectionChat(input) {
  const message = typeof input.message === "string" ? input.message.trim() : "";
  const documentIds = Array.isArray(input.documentIds) ? input.documentIds : [];
  const fieldPath =
    typeof input.fieldPath === "string" && input.fieldPath.trim()
      ? input.fieldPath.trim()
      : null;

  if (!message && documentIds.length === 0 && input.value === undefined) {
    throw Object.assign(
      new Error("message is required (or documentIds / value for fill and apply)."),
      { code: 400 }
    );
  }

  let intent = input.intent;
  if (intent && !isChatIntent(intent)) {
    throw Object.assign(
      new Error(`Unknown intent "${intent}". Use one of: ${CHAT_INTENTS.join(", ")}.`),
      { code: 400 }
    );
  }
  if (!intent) {
    intent = inferChatIntent({
      message,
      fieldPath,
      documentIds,
      value: input.value,
    });
  }

  const ctx = await loadChatContext({
    projectId: input.projectId,
    sectionKey: input.sectionKey,
    fieldPath,
    documentIds,
  });

  const needsDraft = ["resolve_conflict", "fill_missing", "apply_change"].includes(
    intent
  );
  if (needsDraft && (!ctx.row || ctx.row.status !== "SUCCEEDED" || ctx.row.payload == null)) {
    throw Object.assign(
      new Error(
        `Section "${input.sectionKey}" has no SUCCEEDED draft. Wait for extraction before using this chat action.`
      ),
      { code: 409 }
    );
  }

  if ((intent === "resolve_conflict" || intent === "fill_missing") && !fieldPath) {
    throw Object.assign(
      new Error("fieldPath is required for resolve_conflict and fill_missing."),
      { code: 400 }
    );
  }

  const history = normalizeHistory(input.history);
  const userMessage = message || "(user attached documents with no extra text)";

  switch (intent) {
    case "usual":
      return handleUsual({ ctx, history, userMessage, projectId: input.projectId });
    case "source":
      return handleSource({ ctx, history, userMessage, fieldPath });
    case "resolve_conflict":
      return handleResolveConflict({ ctx, history, userMessage, fieldPath });
    case "fill_missing":
      return handleFillMissing({
        ctx,
        history,
        userMessage,
        fieldPath,
        projectId: input.projectId,
        sectionKey: input.sectionKey,
        userId: input.userId,
      });
    case "apply_change":
      return handleApplyChange({
        ctx,
        history,
        userMessage,
        fieldPath,
        value: input.value,
        projectId: input.projectId,
        sectionKey: input.sectionKey,
        userId: input.userId,
      });
    default:
      throw Object.assign(new Error(`Unhandled intent "${intent}".`), { code: 400 });
  }
}

function baseReply(intent, extra = {}) {
  return {
    intent,
    reply: {
      message: extra.message ?? "",
      sources: extra.sources ?? [],
      options: extra.options ?? [],
      changes: extra.changes ?? [],
      found: extra.found ?? null,
      warning: extra.warning ?? null,
      applied: extra.applied ?? false,
    },
    extraction: extra.extraction ?? null,
  };
}

function serializeSources(rawSources, documents) {
  return (rawSources ?? [])
    .filter((item) => item && (item.document_name || item.documentName || item.quote))
    .map((item) => {
      const documentName = item.document_name || item.documentName || "unknown";
      const match = mapDocumentName(documents, documentName);
      return {
        documentId: match?.id ?? item.documentId ?? null,
        documentName: match?.originalFilename ?? documentName,
        quote: item.quote ?? "",
        page: Number.isInteger(item.page) ? item.page : null,
      };
    });
}

function allDocs(ctx) {
  const byId = new Map();
  for (const doc of [...ctx.pipelineDocs, ...ctx.chatbotDocs, ...ctx.scopedDocs]) {
    byId.set(doc.id, doc);
  }
  return [...byId.values()];
}

function extractionSnapshot(row) {
  if (!row) return null;
  return {
    id: row.id,
    extractionRunId: row.extractionRunId,
    sectionKey: row.sectionKey,
    status: row.status,
    payload: row.payload,
    fieldMeta: row.fieldMeta,
    reviewState: row.reviewState ?? {},
    updatedAt: row.updatedAt,
  };
}

async function handleUsual({ ctx, history, userMessage }) {
  const corpus = buildCorpusText(
    [...ctx.pipelineDocs, ...ctx.chatbotDocs],
    ctx.section.relevantDocTypes
  );
  const system = [
    ctx.systemPrompt.content,
    "",
    "You are Nubred AI in the project-creation review chat.",
    "Answer from the NuBred glossary (in the system prompt), this section's draft, and the uploaded documents.",
    "Be concise. If you cite a document, name the filename.",
    "Do not invent contract clauses or field values that are not in the draft or documents.",
  ].join("\n");

  const preamble = [
    `Active section: ${ctx.section.key} (${ctx.section.label})`,
    "Current draft JSON:",
    compactPayload(ctx.row?.payload),
    "",
    "Uploaded documents:",
    corpus.text || "(none)",
  ].join("\n");

  const provider = await ensureProvider();
  const result = await provider.chat({
    systemPrompt: system,
    history: [
      { role: "user", content: preamble },
      { role: "model", content: "Understood. I will answer from the glossary, draft, and documents." },
      ...history,
    ],
    userMessage,
  });

  return baseReply("usual", {
    message: result.text?.trim() || "I could not produce a reply just now. Please try again.",
    extraction: extractionSnapshot(ctx.row),
  });
}

async function handleSource({ ctx, history, userMessage, fieldPath }) {
  const docs = allDocs(ctx);
  const corpus = buildCorpusText(docs, ctx.section.relevantDocTypes);
  const structured = await callStructured({
    ctx,
    history,
    userMessage,
    extraSystem: [
      "The user wants SOURCE citations (filename + short quote).",
      "Fill sources[] with every relevant document snippet. message is a short intro sentence.",
      "options and changes must be empty. found can be true if any source was found.",
      fieldPath ? `Prefer citations for fieldPath ${fieldPath}.` : "",
    ].join("\n"),
    extraUser: [
      "Current draft JSON:",
      compactPayload(ctx.row?.payload),
      "",
      "Stored citations:",
      formatEvidence(ctx.evidence),
      "",
      "Documents:",
      corpus.text || "(none)",
    ].join("\n"),
  });

  const sources = serializeSources(
    structured.sources?.length ? structured.sources : evidenceAsSources(ctx.evidence, fieldPath),
    docs
  );

  return baseReply("source", {
    message:
      structured.message ||
      (sources.length
        ? "Here are the sources I found:"
        : "I could not find a cited source for that in the uploaded documents."),
    sources,
    found: sources.length > 0,
    extraction: extractionSnapshot(ctx.row),
  });
}

async function handleResolveConflict({ ctx, history, userMessage, fieldPath }) {
  const docs = allDocs(ctx);
  const current = getAtPath(ctx.row.payload, fieldPath);
  const corpus = buildCorpusText(docs, ctx.section.relevantDocTypes);
  const structured = await callStructured({
    ctx,
    history,
    userMessage,
    extraSystem: [
      "Resolve a DATA CONFLICT for one field. Do NOT apply a change.",
      "Read both (or more) sources. Summarise each in sources[].",
      "Say which value looks more credible and why in message.",
      "Fill options[] with KEEP <current> and CHANGE TO <other> buttons.",
      "changes must be empty. found true if at least two readings exist.",
      `fieldPath=${fieldPath}. Current draft value=${JSON.stringify(current ?? null)}.`,
    ].join("\n"),
    extraUser: [
      "Stored citations for this field:",
      formatEvidence(ctx.evidence),
      "",
      "Documents:",
      corpus.text || "(none)",
    ].join("\n"),
  });

  const sources = serializeSources(
    structured.sources?.length ? structured.sources : evidenceAsSources(ctx.evidence, fieldPath),
    docs
  );

  let options = (structured.options ?? []).map((option) => ({
    action: option.action === "KEEP" ? "KEEP" : "CHANGE",
    label: option.label,
    value: coerceLlmValue(option.value),
    fieldPath,
  }));

  if (options.length < 2) {
    options = buildFallbackOptions(current, ctx.evidence, fieldPath);
  }

  const distinctDocs = new Set(sources.map((item) => item.documentName)).size;
  const message =
    structured.message ||
    `Sure, based on the document, I found ${Math.max(distinctDocs, sources.length)} confliction data on ${fieldLabelFromPath(fieldPath)} field`;

  return baseReply("resolve_conflict", {
    message,
    sources,
    options,
    found: options.length > 0,
    extraction: extractionSnapshot(ctx.row),
  });
}

async function handleFillMissing({
  ctx,
  history,
  userMessage,
  fieldPath,
  projectId,
  sectionKey,
  userId,
}) {
  const docs = ctx.scopedDocs.length ? ctx.scopedDocs : ctx.chatbotDocs;
  const corpus = buildCorpusText(
    docs.length ? docs : ctx.pipelineDocs,
    ctx.section.relevantDocTypes
  );
  const current = getAtPath(ctx.row.payload, fieldPath);

  const extraSystem = [
    "Fill a MISSING field for the active section only.",
    ctx.scopedDocs.length
      ? "Use ONLY the newly attached chatbot documents. Ignore other project files unless the user described a value in chat."
      : "The user may describe the value in chat instead of attaching a file.",
    `Target fieldPath=${fieldPath}. Current value=${JSON.stringify(current ?? null)}.`,
    "If you find a value: found=true and changes[] with one row (field_path, field_label, previous_value, new_value).",
    "If not found: found=false, empty changes, message explaining nothing was found.",
    "Do not invent values that are not in the new documents or the user message.",
  ].join("\n");

  const structured = await callStructured({
    ctx,
    history,
    userMessage,
    extraSystem,
    extraUser: [
      "New / scoped documents:",
      corpus.text || "(none — user may have described the value in the message)",
      "",
      "Draft JSON (for field location only):",
      compactPayload(ctx.row.payload),
    ].join("\n"),
  });

  if (!structured.found || !(structured.changes ?? []).length) {
    return baseReply("fill_missing", {
      message:
        structured.message ||
        `I could not find ${fieldLabelFromPath(fieldPath)} in the uploaded document. Please share another file or describe it here.`,
      found: false,
      applied: false,
      extraction: extractionSnapshot(ctx.row),
    });
  }

  const result = await applyChatChanges({
    projectId,
    sectionKey,
    userId,
    changes: structured.changes,
    reason: userMessage.slice(0, 500),
  });

  if (structured.sources?.length) {
    await appendFieldEvidence({
      projectId,
      sectionKey,
      fieldPath,
      sources: structured.sources,
      documents: docs.length ? docs : allDocs(ctx),
    });
  }

  const latest = await requireSucceededDraft(projectId, sectionKey);
  return baseReply("fill_missing", {
    message: changeCountMessage(result.applied),
    sources: serializeSources(structured.sources, docs.length ? docs : allDocs(ctx)),
    changes: toChangeCards(result.applied),
    found: true,
    applied: true,
    warning: result.warning,
    extraction: extractionSnapshot(latest),
  });
}

async function handleApplyChange({
  ctx,
  history,
  userMessage,
  fieldPath,
  value,
  projectId,
  sectionKey,
  userId,
}) {
  if (value !== undefined && fieldPath) {
    const result = await applyChatChanges({
      projectId,
      sectionKey,
      userId,
      changes: [
        {
          fieldPath,
          fieldLabel: fieldLabelFromPath(fieldPath),
          value,
        },
      ],
      reason: userMessage.slice(0, 500) || "Chatbot apply_change",
    });
    return baseReply("apply_change", {
      message: changeCountMessage(result.applied),
      changes: toChangeCards(result.applied),
      found: true,
      applied: true,
      warning: result.warning,
      extraction: extractionSnapshot(result.section),
    });
  }

  const corpus = buildCorpusText(
    [...ctx.pipelineDocs, ...ctx.chatbotDocs],
    ctx.section.relevantDocTypes
  );
  const structured = await callStructured({
    ctx,
    history,
    userMessage,
    extraSystem: [
      "The user wants to CHANGE one or more draft fields.",
      "Parse which field_path values to write. Include cascading fields (e.g. a count when a list changes).",
      "found=true and changes[] filled when the request is clear and values fit the draft shape.",
      "If you cannot tell which field, found=false and ask a clarifying question. Empty changes.",
      fieldPath ? `Preferred target fieldPath=${fieldPath}.` : "",
    ].join("\n"),
    extraUser: [
      "Current draft JSON:",
      compactPayload(ctx.row.payload),
      "",
      "Documents (for context, do not re-extract the whole section):",
      corpus.text || "(none)",
    ].join("\n"),
  });

  if (!structured.found || !(structured.changes ?? []).length) {
    return baseReply("apply_change", {
      message:
        structured.message ||
        "I could not tell which field to change. Name the field and the new value.",
      found: false,
      applied: false,
      extraction: extractionSnapshot(ctx.row),
    });
  }

  const result = await applyChatChanges({
    projectId,
    sectionKey,
    userId,
    changes: structured.changes,
    reason: userMessage.slice(0, 500),
  });

  return baseReply("apply_change", {
    message: `${changeCountMessage(result.applied)}${
      structured.message ? `\n\n${structured.message}` : ""
    }`.trim(),
    changes: toChangeCards(result.applied),
    found: true,
    applied: true,
    warning: result.warning,
    extraction: extractionSnapshot(result.section),
  });
}

function evidenceAsSources(evidence, fieldPath) {
  const rows = fieldPath
    ? evidence.filter(
        (item) =>
          item.fieldPath === fieldPath ||
          item.fieldPath.startsWith(`${fieldPath}.`) ||
          item.fieldPath.startsWith(`${fieldPath}[`)
      )
    : evidence;
  return rows.map((item) => ({
    document_name: item.documentName,
    quote: item.quote,
    page: item.page,
    documentId: item.documentId,
  }));
}

function buildFallbackOptions(current, evidence, fieldPath) {
  const options = [];
  if (current != null && current !== "") {
    const labelVal = typeof current === "string" ? current : JSON.stringify(current);
    options.push({
      action: "KEEP",
      label: `KEEP ${String(labelVal).toUpperCase()}`,
      value: current,
      fieldPath,
    });
  }
  const names = [...new Set(evidence.map((item) => item.documentName))];
  void names;
  return options;
}

function isMockProvider() {
  return (process.env.NUBRED_LLM_PROVIDER ?? "gemini").trim().toLowerCase() === "mock";
}

async function callStructured({ ctx, history, userMessage, extraSystem, extraUser }) {
  if (isMockProvider()) {
    return {
      ...EMPTY_STRUCTURED,
      message: `[MockProvider] ${userMessage.slice(0, 120)}`,
      found: false,
    };
  }

  const system = [
    ctx.systemPrompt.content,
    "",
    "You are Nubred AI. Reply ONLY via the JSON schema.",
    extraSystem,
  ]
    .filter(Boolean)
    .join("\n");

  const historyBlock = history
    .map((turn) => `${turn.role === "model" ? "Assistant" : "User"}: ${turn.content}`)
    .join("\n");

  const userContent = [
    extraUser,
    historyBlock ? `\nRecent chat:\n${historyBlock}` : "",
    `\nUser: ${userMessage}`,
  ]
    .filter(Boolean)
    .join("\n");

  const provider = await ensureProvider();
  const result = await provider.extract({
    systemPrompt: system,
    promptHash: ctx.systemPrompt.hash,
    userContent,
    schema: chatStructuredSchema,
  });

  const parsed = chatStructuredSchema.safeParse(result.data);
  if (!parsed.success) {
    return {
      ...EMPTY_STRUCTURED,
      message: typeof result.data?.message === "string" ? result.data.message : "",
    };
  }
  return parsed.data;
}
