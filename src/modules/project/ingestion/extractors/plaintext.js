/**
 * @param {Buffer} buffer
 * @returns {Promise<string[]>}
 */
export async function extractPlaintextPages(buffer) {
  return [buffer.toString("utf8")];
}
