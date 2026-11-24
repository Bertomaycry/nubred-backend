/**
 * Which client module flag gates each extraction section.
 */
export const SECTION_MODULE = {
  contract: "contract",
  genotype: "genotype",
  ip_right: "ip_right",
  supply_chain: "model_supply_chain",
  quarantine: "quarantine",
  timeline: "timeline",
  todo: "todo",
  protocol: "protocol",
  observation: "field_observation",
  phase: "phase",
  project_overview: null, // always on for VM
};

export function moduleForSection(sectionKey) {
  return SECTION_MODULE[sectionKey] ?? null;
}

/** @param {Set<string>} enabled */
export function isSectionEnabled(sectionKey, enabled) {
  if (sectionKey === "project_overview") return true;
  const moduleId = moduleForSection(sectionKey);
  return moduleId ? enabled.has(moduleId) : false;
}

/** Section keys enabled for this client tenant. */
export function enabledSectionKeys(enabledModules) {
  return Object.keys(SECTION_MODULE).filter((key) =>
    isSectionEnabled(key, enabledModules)
  );
}