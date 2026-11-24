/**
 * Normalise quote for fuzzy lookup on page text.
 * @param {string} quote
 */
export function normaliseQuote(quote) {
  return String(quote ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * @param {string} quote
 * @param {Array<{ text: string }>} pages
 */
export function quoteVerifiedOnPages(quote, pages) {
  const needle = normaliseQuote(quote);
  if (!needle || needle.length < 8) return false;
  const compact = needle.replace(/[^a-z0-9]/g, "");
  for (const page of pages ?? []) {
    const hay = normaliseQuote(page.text);
  if (hay.includes(needle)) return true;
    const hayCompact = hay.replace(/[^a-z0-9]/g, "");
    if (compact.length >= 12 && hayCompact.includes(compact)) return true;
  }
  return false;
}