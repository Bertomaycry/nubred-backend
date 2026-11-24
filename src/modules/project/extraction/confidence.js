import { normalizeDocumentKind } from "../storage/allowed.js";

/**
 * Confidence from document kind and the signed flag.
 * Signed, or an official record, is CONFIRMED. Everything else is PROVISIONAL.
 * @param {{ signed?: boolean | null, detectedType?: string | null, documentType?: string }} doc
 */
export function confidenceFromDocument(doc) {
  if (doc.signed === true) return "CONFIRMED";
  const kind = normalizeDocumentKind(doc.detectedType) || normalizeDocumentKind(doc.documentType);
  if (kind === "OFFICIAL_RECORD") return "CONFIRMED";
  return "PROVISIONAL";
}