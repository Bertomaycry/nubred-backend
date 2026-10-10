/**
 * Section Registry — the single source of truth for all project sections.
 *
 * Every section must be registered here before it can be used anywhere in the
 * codebase. The registry enforces:
 *   - Unique section keys
 *   - Required fields on every registration (key, label, order, kind, schema, rules)
 *   - Type validation on section kind
 *
 * Usage:
 *   import { getSection, getEnabledSections, getAllSections } from './registry.js';
 *
 *   const contract = getSection('contract');       // throws if not found
 *   const active   = getEnabledSections();         // only enabled: true sections, sorted by order
 *   const all      = getAllSections();              // all registered sections, sorted by order
 *
 * Adding a new section later:
 *   1. Create a folder under sections/<key>/ with index.js, <key>.schema.js, <key>.rules.js, prompts/
 *   2. Import the section definition below
 *   3. Call register(mySection) — that's it. No other files need to change.
 */

import { contractSection }   from "./contract/index.js";
import { genotypeSection }   from "./genotype/index.js";
import { phaseSection }      from "./phase/index.js";
import { protocolSection }   from "./protocol/index.js";
import { chronologySection } from "./chronology/index.js";

// ---------------------------------------------------------------------------
// Registry internals
// ---------------------------------------------------------------------------

/** @type {Map<string, SectionDefinition>} */
const _registry = new Map();

/**
 * @typedef {Object} SectionDefinition
 * @property {string}   key            - Unique section identifier (snake_case)
 * @property {string}   label          - Human-readable display label
 * @property {number}   order          - Default confirmation order (1 = first); DB can override per project
 * @property {'extractor'|'deriver'} kind
 *   extractor: runs an LLM extraction pass over uploaded documents.
 *   deriver:   aggregates structured output from other sections (no direct document read).
 * @property {boolean}  enabled        - False = data model active but section is not presented to VM yet
 * @property {import('zod').ZodSchema} schema  - Extraction output schema (Zod)
 * @property {Object}   rules          - Confirmation blocking and warning rules
 * @property {string|null} promptDir   - Absolute path to prompts/ directory (null for deriver stubs)
 * @property {string[]} relevantDocTypes - Document types that primarily feed this section
 */

/**
 * Register a section definition. Throws if the key is already registered or
 * required fields are missing.
 *
 * @param {SectionDefinition} section
 */
function register(section) {
  // --- Validation ---
  const required = ["key", "label", "order", "kind", "enabled", "schema", "rules"];
  for (const field of required) {
    if (section[field] === undefined) {
      throw new Error(
        `Section registration error: missing required field "${field}" on section "${section.key ?? "(unknown)"}"`
      );
    }
  }
  if (!["extractor", "deriver"].includes(section.kind)) {
    throw new Error(
      `Section registration error: invalid kind "${section.kind}" on section "${section.key}". ` +
        `Must be 'extractor' or 'deriver'.`
    );
  }
  if (_registry.has(section.key)) {
    throw new Error(
      `Section registration error: key "${section.key}" is already registered.`
    );
  }

  _registry.set(section.key, Object.freeze(section));
}

// ---------------------------------------------------------------------------
// Register the five current sections in confirmation order.
// ---------------------------------------------------------------------------

register(contractSection);    // order: 1 — extractor
register(genotypeSection);    // order: 2 — extractor
register(phaseSection);       // order: 3 — extractor
register(protocolSection);    // order: 4 — extractor
register(chronologySection);  // order: 5 — deriver

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a section by key. Throws if the key is not registered.
 * Use this when you have a user-supplied key and want to fail loudly on typos.
 *
 * @param {string} key
 * @returns {SectionDefinition}
 */
export function getSection(key) {
  const section = _registry.get(key);
  if (!section) {
    throw new Error(
      `Section "${key}" is not registered. ` +
        `Registered keys: ${[..._registry.keys()].join(", ")}`
    );
  }
  return section;
}

/**
 * Get all enabled sections sorted by their default order.
 * This is what the VM sees in the confirmation UI.
 *
 * @returns {SectionDefinition[]}
 */
export function getEnabledSections() {
  return [..._registry.values()]
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);
}

/**
 * Get all registered sections, sorted by order.
 *
 * @returns {SectionDefinition[]}
 */
export function getAllSections() {
  return [..._registry.values()].sort((a, b) => a.order - b.order);
}

/**
 * Get all extractor sections that are enabled.
 * Used by the pipeline to build the extraction fan-out.
 *
 * @returns {SectionDefinition[]}
 */
export function getExtractorSections() {
  return getEnabledSections().filter((s) => s.kind === "extractor");
}

/**
 * Get all deriver sections that are enabled.
 * Used by the pipeline to run derivations after extractors complete.
 *
 * @returns {SectionDefinition[]}
 */
export function getDeriverSections() {
  return getEnabledSections().filter((s) => s.kind === "deriver");
}

/**
 * Check whether a key is registered (without throwing).
 * Useful for validating user input before calling getSection().
 *
 * @param {string} key
 * @returns {boolean}
 */
export function isSectionKey(key) {
  return _registry.has(key);
}
