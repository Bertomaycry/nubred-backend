import { extractPdfPages } from "./extractors/pdf.js";
import { extractDocxPages } from "./extractors/docx.js";
import { extractSpreadsheetPages } from "./extractors/spreadsheet.js";
import { extractPlaintextPages } from "./extractors/plaintext.js";

/**
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<{ pages: Array<{ pageNumber: number, text: string, charCount: number }> }>}
 */
export async function extractDocumentText(buffer, mimeType) {
  const pages = await extractPages(buffer, mimeType);
  return {
    pages: pages.map((text, index) => ({
      pageNumber: index + 1,
      text,
      charCount: text.length,
    })),
  };
}

async function extractPages(buffer, mimeType) {
  switch (mimeType) {
    case "application/pdf":
      return extractPdfPages(buffer);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return extractDocxPages(buffer);
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.ms-excel":
      return extractSpreadsheetPages(buffer);
    case "text/plain":
    case "text/csv":
    case "message/rfc822":
      return extractPlaintextPages(buffer);
    default:
      throw new Error(`No text extractor registered for MIME type "${mimeType}".`);
  }
}
