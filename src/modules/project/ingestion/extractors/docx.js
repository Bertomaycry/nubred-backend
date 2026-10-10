/**
 * DOCX has no reliable page map — store as a single page of extracted text.
 * @param {Buffer} buffer
 * @returns {Promise<string[]>}
 */
export async function extractDocxPages(buffer) {
  const mammothMod = await import("mammoth");
  const mammoth = mammothMod.default ?? mammothMod;
  const result = await mammoth.extractRawText({ buffer });
  return [String(result.value ?? "").trimEnd()];
}
