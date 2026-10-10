/**
 * Assemble READY document page text for an LLM extraction call.
 *
 * Relevant document types for the section are listed first so the model
 * sees primary sources before annexes and emails.
 */

const DEFAULT_MAX_CHARS = 350_000;

function getMaxChars() {
  const parsed = Number.parseInt(process.env.NUBRED_EXTRACTION_MAX_CHARS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_CHARS;
}

/** READY documents that feed full-section extraction (excludes chatbot attachments). */
export function pipelineDocumentWhere(projectId) {
  return { projectId, status: "READY", origin: "UPLOAD" };
}

/**
 * @param {Array<{
 *   originalFilename: string,
 *   documentType: string,
 *   pages: Array<{ pageNumber: number, text: string }>
 * }>} documents
 * @param {string[]} [relevantDocTypes]
 * @param {{ maxChars?: number }} [options]
 * @returns {{ text: string, truncated: boolean, documentCount: number, pageCount: number }}
 */
export function assembleCorpus(documents, relevantDocTypes = [], options = {}) {
  const priority = new Set(relevantDocTypes);
  const sorted = [...documents].sort((a, b) => {
    const aPri = priority.has(a.documentType) ? 0 : 1;
    const bPri = priority.has(b.documentType) ? 0 : 1;
    if (aPri !== bPri) return aPri - bPri;
    return a.originalFilename.localeCompare(b.originalFilename);
  });

  const maxChars =
    Number.isFinite(options.maxChars) && options.maxChars > 0
      ? options.maxChars
      : getMaxChars();
  const parts = [];
  let used = 0;
  let truncated = false;
  let pageCount = 0;

  for (const doc of sorted) {
    const header = `\n\n### ${doc.originalFilename}  [${doc.documentType}]\n`;
    if (used + header.length > maxChars) {
      truncated = true;
      break;
    }
    parts.push(header);
    used += header.length;

    const pages = [...(doc.pages ?? [])].sort(
      (a, b) => a.pageNumber - b.pageNumber
    );

    for (const page of pages) {
      const block = `\n[page ${page.pageNumber}]\n${page.text ?? ""}\n`;
      if (used + block.length > maxChars) {
        truncated = true;
        break;
      }
      parts.push(block);
      used += block.length;
      pageCount += 1;
    }
    if (truncated) break;
  }

  return {
    text: parts.join("").trim(),
    truncated,
    documentCount: sorted.length,
    pageCount,
  };
}
