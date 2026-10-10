/**
 * Map extraction strings onto Prisma enums. Invalid values become null
 * so a confirm never fails on a leftover LLM token.
 */

export const CONTRACT_FAMILIES = [
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8",
  "F9", "F10", "F11", "F12", "F13", "F14", "F15",
  "F16", "F17", "F18", "F19", "F20", "F21", "F22",
  "F23", "F24", "UNCLASSIFIED",
];

export const PARTY_ROLES = [
  "BREEDER", "PRINCIPAL", "LICENSOR", "IVM", "LICENSEE", "NURSERY",
  "LICENSED_GROWER", "PACKHOUSE", "MARKETER", "CONSULTANT", "LPM",
  "CONTRACTOR", "ASSOCIATION_OF_PRODUCERS", "UNKNOWN",
];

export const FLAG_TYPES = ["ABSENCE", "ANOMALY", "IMBALANCE"];
export const FLAG_SEVERITIES = ["HIGH", "MEDIUM", "LOW"];
export const DEVELOPMENT_STATUSES = ["SELECTION", "VARIETY", "UNKNOWN"];
export const PHASE_TYPES = ["TRIAL", "PILOT", "LAUNCH", "SCALE", "CUSTOM"];
export const PHASE_CATEGORIES = ["EXPERIMENTAL", "COMMERCIAL"];
export const GENOTYPE_DECISIONS = ["PROMOTE", "REPEAT", "DISCARD"];
export const PROTOCOL_TYPES = ["OBSERVATIONAL", "COMMERCIAL"];
export const PARAMETER_FAMILIES = ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8"];
export const PARAMETER_LEVELS = ["UNIVERSAL", "SPECIES_STANDARD", "PROJECT_CUSTOM"];
export const PARAMETER_INPUT_TYPES = [
  "NUMBER", "SCALE", "OPTION", "DISTRIBUTION", "DATE", "BOOLEAN", "PHOTO", "TEXT",
];
export const FREQUENCY_TYPES = ["CALENDAR_FIXED", "EVENT_BASED", "PHASE_GATE", "ON_DEMAND"];
export const SCALE_POLARITIES = ["HIGHER_BETTER", "LOWER_BETTER"];
export const ELIMINATORY_LEVELS = ["L1", "L2", "L3"];
export const CHRONOLOGY_EVENT_TYPES = [
  "CONTRACT_SIGNATURE", "CONTRACT_AMENDMENT", "PHASE_ADVANCEMENT", "PHASE_START",
  "PHASE_GATE", "IP_FILING", "IP_GRANT", "IP_EXPIRY", "QUARANTINE_START",
  "QUARANTINE_CERTIFICATION", "HARVEST_DECLARATION", "OBSERVATION_MILESTONE",
  "MEETING_DECISION", "EMAIL_EXCHANGE", "ROYALTY_PAYMENT", "OPTION_EXERCISE", "OTHER",
];
export const DATE_PRECISIONS = ["EXACT", "ESTIMATED", "INFERRED"];

export function asEnum(value, allowed, fallback = null) {
  if (value == null || value === "") return fallback;
  return allowed.includes(value) ? value : fallback;
}

export function asInt(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

export function asFloat(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Keep unique ISO 3166-1 alpha-2 codes (uppercase). Drop anything else.
 * @param {unknown} value
 * @returns {string[]}
 */
export function asIsoCountryCodes(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const codes = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const code = item.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code) || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes;
}
