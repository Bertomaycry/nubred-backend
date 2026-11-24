/**
 * Section Registry — v2 field-tree sections (11 keys).
 */

import { contractSection } from "./contract/index.js";
import { genotypeSection } from "./genotype/index.js";
import { ipRightSection } from "./ip_right/index.js";
import { supplyChainSection } from "./supply_chain/index.js";
import { quarantineSection } from "./quarantine/index.js";
import { timelineSection } from "./timeline/index.js";
import { todoSection } from "./todo/index.js";
import { protocolSection } from "./protocol/index.js";
import { observationSection } from "./observation/index.js";
import { phaseSection } from "./phase/index.js";
import { projectOverviewSection } from "./project_overview/index.js";
import { READING_ORDER } from "./field-tree/index.js";

/** @type {Map<string, import("./make-section.js").SectionDefinition>} */
const _registry = new Map();

/**
 * @typedef {ReturnType<typeof import("./make-section.js").makeSectionDefinition>} SectionDefinition
 */

function register(section) {
  const required = ["key", "label", "order", "kind", "enabled", "schema", "rules", "fieldTree"];
  for (const field of required) {
    if (section[field] === undefined) {
      throw new Error(`Section registration error: missing "${field}" on "${section.key ?? "(unknown)"}"`);
    }
  }
  if (!["extractor", "deriver", "hybrid"].includes(section.kind)) {
    throw new Error(`Invalid kind "${section.kind}" on section "${section.key}"`);
  }
  if (_registry.has(section.key)) {
    throw new Error(`Section key "${section.key}" is already registered.`);
  }
  _registry.set(section.key, Object.freeze(section));
}

register(contractSection);
register(genotypeSection);
register(ipRightSection);
register(supplyChainSection);
register(quarantineSection);
register(timelineSection);
register(todoSection);
register(protocolSection);
register(observationSection);
register(phaseSection);
register(projectOverviewSection);

export { READING_ORDER };

export function getSection(key) {
  const section = _registry.get(key);
  if (!section) {
    throw new Error(
      `Section "${key}" is not registered. Registered: ${[..._registry.keys()].join(", ")}`
    );
  }
  return section;
}

export function getEnabledSections() {
  return [..._registry.values()].filter((s) => s.enabled).sort((a, b) => a.order - b.order);
}

export function getAllSections() {
  return [..._registry.values()].sort((a, b) => a.order - b.order);
}

/** Sections that run per-document LLM (not pure derivers). */
export function getExtractorSections() {
  return getEnabledSections().filter((s) => s.kind === "extractor" || s.kind === "hybrid");
}

export function getDeriverSections() {
  return getEnabledSections().filter((s) => s.kind === "deriver");
}

/** Reading order for the v2 pipeline (master-filter section keys). */
export function getReadingOrderSections(enabledKeys) {
  const enabled = new Set(enabledKeys);
  return READING_ORDER.filter((key) => enabled.has(key)).map((key) => getSection(key));
}

export function isSectionKey(key) {
  return _registry.has(key);
}

export function getSectionDefinition(sectionKey) {
  const section = getSection(sectionKey);
  return section.definition;
}