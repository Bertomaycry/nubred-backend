/**
 * Split extracted PDF text into one string per page.
 * @param {Buffer} buffer
 * @returns {Promise<string[]>}
 */
export async function extractPdfPages(buffer) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });

  if (Array.isArray(text)) {
    return text.map((page) => String(page ?? "").trimEnd());
  }
  return [String(text ?? "")];
}
