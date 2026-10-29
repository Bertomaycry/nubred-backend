/**
 * Which client module flag gates each extraction section.
 * (Flags are the 13 ids in src/modules/client/modules.js.)
 */
export const SECTION_MODULE = {
  contract: "contract",
  genotype: "genotype",
  phase: "phase",
  protocol: "protocol",
  chronology: "timeline",
};

export function moduleForSection(sectionKey) {
  return SECTION_MODULE[sectionKey] ?? null;
}

/** @param {Set<string>} enabled */
export function isSectionEnabled(sectionKey, enabled) {
  const moduleId = moduleForSection(sectionKey);
  return moduleId ? enabled.has(moduleId) : false;
}
