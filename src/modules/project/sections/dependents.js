import { READING_ORDER } from "./field-tree/index.js";
import { getSection } from "./registry.js";

/**
 * Sections this one reads, taken from `contextFields` ("contract.parties" → "contract").
 * project_overview reads every section ("*").
 * @param {string} sectionKey
 * @returns {string[]}
 */
export function upstreamKeys(sectionKey) {
  const fields = getSection(sectionKey).contextFields ?? [];
  if (fields.includes("*")) {
    return READING_ORDER.filter((key) => key !== sectionKey);
  }
  return [
    ...new Set(
      fields
        .map((entry) => String(entry).split(".")[0])
        .filter((key) => key && key !== sectionKey && READING_ORDER.includes(key))
    ),
  ];
}

/**
 * Every section that reads `sectionKey`, directly or through another section,
 * in an order where each section comes after the sections it reads.
 * @param {string} sectionKey
 * @param {string[]} [enabledKeys] limit to these keys (module switches)
 * @returns {string[]}
 */
export function sectionDependents(sectionKey, enabledKeys = READING_ORDER) {
  const enabled = new Set(enabledKeys);
  const affected = new Set();
  const queue = [sectionKey];
  while (queue.length) {
    const current = queue.shift();
    for (const key of READING_ORDER) {
      if (key === sectionKey || affected.has(key) || !enabled.has(key)) continue;
      if (upstreamKeys(key).includes(current)) {
        affected.add(key);
        queue.push(key);
      }
    }
  }

  const ordered = [];
  const placed = new Set([sectionKey]);
  while (ordered.length < affected.size) {
    const ready = READING_ORDER.find(
      (key) =>
        affected.has(key) &&
        !placed.has(key) &&
        upstreamKeys(key).every((up) => !affected.has(up) || placed.has(up))
    );
    const next = ready ?? READING_ORDER.find((key) => affected.has(key) && !placed.has(key));
    ordered.push(next);
    placed.add(next);
  }
  return ordered;
}

const CASCADE_SCOPE = /^section:([a-z_]+)\+cascade$/;

/** @param {string} sectionKey */
export function cascadeScope(sectionKey) {
  return `section:${sectionKey}+cascade`;
}

/**
 * @param {string | null | undefined} scope
 * @returns {string | null} the section the user asked to extract
 */
export function cascadeRootKey(scope) {
  return CASCADE_SCOPE.exec(String(scope ?? ""))?.[1] ?? null;
}
