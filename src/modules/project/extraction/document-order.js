import { normalizeDocumentKind } from "../storage/allowed.js";

/** Sort documents for v2 pipeline reading order. */
export function sortDocumentsForPipeline(documents) {
  const priority = (doc) => {
    const kind = normalizeDocumentKind(doc.detectedType) || normalizeDocumentKind(doc.documentType) || "OTHER";
    if (kind === "CONTRACT" && doc.signed === true) return 0;
    if (kind === "CONTRACT") return 1;
    if (kind === "ANNEX_ADDENDUM") return 2;
    if (kind === "OFFICIAL_RECORD") return 3;
    if (kind === "PROTOCOL") return 4;
    if (kind === "CORRESPONDENCE") return 6;
    return 5;
  };

  return [...documents].sort((a, b) => {
    const p = priority(a) - priority(b);
    if (p !== 0) return p;
    const da = a.documentDate || a.createdAt?.toISOString?.() || "";
    const db = b.documentDate || b.createdAt?.toISOString?.() || "";
    if (da !== db) return da.localeCompare(db);
    return a.originalFilename.localeCompare(b.originalFilename);
  });
}

export function documentUnprocessed(document) {
  return !document.processedAt;
}