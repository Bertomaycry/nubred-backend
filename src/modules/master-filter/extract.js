import { extractPdfPages } from "../project/ingestion/extractors/pdf.js";
import { extractDocxPages } from "../project/ingestion/extractors/docx.js";
import { ClientError } from "../client/provision.js";
import { MAX_CONTENT_CHARS } from "./upload-policy.js";

const UNREADABLE = "We could not read any text from this file.";

async function rawText(buffer, mimeType) {
  switch (mimeType) {
    case "application/pdf":
      return (await extractPdfPages(buffer)).join("\n\n");
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return (await extractDocxPages(buffer)).join("\n\n");
    default:
      return buffer.toString("utf8").replace(/^\uFEFF/, "");
  }
}

/**
 * Plain text for a filter file. Never truncates.
 * @param {Buffer} buffer
 * @param {string} mimeType normalized
 * @returns {Promise<string>}
 * @throws {ClientError} 422 when unreadable, empty or over the cap
 */
export async function extractFilterText(buffer, mimeType) {
  let text;
  try {
    text = await rawText(buffer, mimeType);
  } catch (error) {
    console.warn(`Filter text extraction failed (${mimeType}): ${error.message}`);
    throw new ClientError(422, UNREADABLE);
  }

  text = text.replace(/\r\n?/g, "\n").trim();
  if (!text) throw new ClientError(422, UNREADABLE);
  if (text.length > MAX_CONTENT_CHARS) {
    throw new ClientError(
      422,
      "This file has too much text. The limit is 1,000,000 characters."
    );
  }
  return text;
}
