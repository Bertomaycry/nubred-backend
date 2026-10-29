/**
 * Project section visibility by role — Doc A (Multi-Actor Portal & Roles V3).
 *
 *   functional_req_docs/NuBred_DocA_MultiActorPortal_Roles_V3_130526.pdf
 *
 * Levels in the table: full | read | own | hidden.
 * "own" (own contracts, own genotypes, own segment, own tasks, own assigned
 * phases) needs links from actors to contracts / genotypes / plots that do not
 * exist yet, so it is served as HIDDEN until they do. That never shows one
 * actor another actor's data.
 */

export const LEVEL = { HIDDEN: 0, READ: 1, FULL: 2 };

/** The 7 Doc A project sections, in tab order. */
export const DOC_A_SECTIONS = [
  "overview",
  "genotype",
  "supply_chain",
  "phases",
  "contracts",
  "ip_rights",
  "todo",
];

/** Section keys served by the extraction API -> Doc A section. */
const API_SECTION_TO_DOC_A = {
  contract: "contracts",
  genotype: "genotype",
  phase: "phases",
  protocol: "phases",
  // Out of MVP tab bar: Variety Manager only.
  chronology: "chronology",
};

// Doc A "Section visibility by role" table.
const TABLE = {
  VARIETY_MANAGER: {
    overview: "full",
    genotype: "full",
    supply_chain: "full",
    phases: "full",
    contracts: "full",
    ip_rights: "full",
    todo: "full",
    chronology: "full",
  },
  NURSERY: {
    overview: "read",
    genotype: "own",
    supply_chain: "own",
    phases: "read",
    contracts: "own",
    ip_rights: "hidden",
    todo: "own",
    chronology: "hidden",
  },
  GROWER: {
    overview: "read",
    genotype: "own",
    supply_chain: "own",
    phases: "read",
    contracts: "own",
    ip_rights: "hidden",
    todo: "own",
    chronology: "hidden",
  },
  PACKHOUSE_MARKETER: {
    overview: "read",
    genotype: "hidden",
    supply_chain: "own",
    phases: "hidden",
    contracts: "own",
    ip_rights: "hidden",
    todo: "own",
    chronology: "hidden",
  },
  FIELD_OBSERVER: {
    overview: "hidden",
    genotype: "hidden",
    supply_chain: "hidden",
    phases: "own", // "Own assigned"
    contracts: "hidden",
    ip_rights: "hidden",
    todo: "hidden",
    chronology: "hidden",
  },
};

/** Table cell -> level actually served today ("own" is not served yet). */
function effective(cell) {
  if (cell === "full") return LEVEL.FULL;
  if (cell === "read") return LEVEL.READ;
  return LEVEL.HIDDEN;
}

/**
 * @param {string | null} role ProjectRole
 * @param {string} section Doc A section (or "chronology")
 * @param {{ isFieldObserver?: boolean }} [options]
 * @returns {number} LEVEL value
 */
export function sectionLevel(role, section, { isFieldObserver = false } = {}) {
  const primary = effective(TABLE[role]?.[section]);
  const observer = isFieldObserver ? effective(TABLE.FIELD_OBSERVER[section]) : 0;
  return Math.max(primary, observer);
}

export function levelName(level) {
  if (level >= LEVEL.FULL) return "full";
  if (level >= LEVEL.READ) return "read";
  return "hidden";
}

/** Doc A section a given API section key belongs to. */
export function docASectionFor(apiSectionKey) {
  return API_SECTION_TO_DOC_A[apiSectionKey] ?? null;
}

/**
 * Access map for all 7 Doc A sections (for greying out tabs).
 * @returns {Record<string, "full" | "read" | "hidden">}
 */
export function buildSectionAccess(role, options) {
  return Object.fromEntries(
    DOC_A_SECTIONS.map((section) => [
      section,
      levelName(sectionLevel(role, section, options)),
    ])
  );
}
