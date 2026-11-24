/** @typedef {'string'|'text'|'int'|'decimal'|'date'|'date_dm'|'boolean'|'option'|'option_multi'|'list'|'ref'|'ref_multi'} FieldType */

/**
 * @typedef {Object} FieldRef
 * @property {string} section
 * @property {string} [group]
 */

/**
 * @typedef {Object} FieldDerive
 * @property {string[]} from
 * @property {string} fn
 */

/**
 * @typedef {Object} FieldDef
 * @property {string} key
 * @property {string} label
 * @property {FieldType} type
 * @property {string[]} [options]
 * @property {FieldRef} [ref]
 * @property {{ field: string, equals?: string, in?: string[] }} [showIf]
 * @property {string[]} [contractTypes]
 * @property {boolean} [required]
 * @property {FieldDerive} [derive]
 * @property {string} [uiGroup]
 * @property {string} [combo]
 * @property {string} [describe]
 */

/**
 * @typedef {Object} GroupDef
 * @property {string} key
 * @property {string} label
 * @property {boolean} [repeatable]
 * @property {string[]} [identity]
 * @property {string[]} [contractTypes]
 * @property {(FieldDef|GroupDef)[]} children
 */

/**
 * @typedef {Object} SectionFieldTree
 * @property {string} sectionKey
 * @property {(FieldDef|GroupDef)[]} children
 * @property {string[]} [contextFields]
 * @property {{ key: string, label: string, nodes: (FieldDef|GroupDef)[] }[]} [extractionParts]
 */

export const FIELD_STATUS = ["found", "not_found", "not_applicable"];
export const FIELD_CONFIDENCE = ["confirmed", "provisional", "conflicting"];
export const FIELD_REVIEW = ["pending", "accepted", "gap", "edited"];

export const READING_ORDER = [
  "contract",
  "genotype",
  "ip_right",
  "supply_chain",
  "quarantine",
  "timeline",
  "todo",
  "protocol",
  "observation",
  "phase",
  "project_overview",
];

/** @param {FieldDef} def */
export function field(def) {
  return { ...def, kind: "field" };
}

/** @param {GroupDef} def */
export function group(def) {
  return { ...def, kind: "group" };
}

/** @param {FieldDef|GroupDef} node */
export function isGroup(node) {
  return node?.kind === "group";
}