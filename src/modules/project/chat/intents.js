export const CHAT_INTENTS = [
  "usual",
  "source",
  "resolve_conflict",
  "fill_missing",
  "apply_change",
];

export const DOWNSTREAM_WARNING =
  "Your change might affect the next section that has not been reviewed yet";

export function isChatIntent(value) {
  return CHAT_INTENTS.includes(value);
}

/**
 * Infer intent when the frontend omits it.
 * Resolve-conflict and missing-part entry points should still send intent explicitly.
 */
export function inferChatIntent({ message, fieldPath, documentIds, value }) {
  if (Array.isArray(documentIds) && documentIds.length > 0) return "fill_missing";
  if (value !== undefined && fieldPath) return "apply_change";

  const text = String(message ?? "").toLowerCase();
  if (fieldPath && /conflict/i.test(text)) return "resolve_conflict";
  if (fieldPath && /missing|fix the missing/i.test(text)) return "fill_missing";
  if (
    /list down the source|source of|citation|where (is|was) .* mentioned|show (the )?source/.test(
      text
    )
  ) {
    return "source";
  }
  if (
    /\b(change|remove|update|replace|set|keep)\b/.test(text) &&
    (fieldPath || / to | into | from /.test(text))
  ) {
    return "apply_change";
  }
  return "usual";
}

export function fieldLabelFromPath(fieldPath) {
  if (!fieldPath) return "Field";
  const last = fieldPath.replace(/\[\d+\]/g, "").split(".").filter(Boolean).pop();
  if (!last) return fieldPath;
  return last
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function coerceLlmValue(raw) {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "" || raw === "null") return null;
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export function stringifyDisplay(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
