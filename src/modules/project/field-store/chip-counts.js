import { walkFields } from "../sections/field-tree/traverse.js";

/**
 * @param {import("../sections/make-section.js").SectionDefinition} section
 * @param {Array<{ status: string, confidence: string, review: string, value: unknown, openCandidates: number }>} fields
 */
export function computeChipCounts(section, fields) {
  const counts = {
    all: 0,
    valid: 0,
    provisional: 0,
    conflict: 0,
    missing: 0,
    readOnly: 0,
  };

  const defs = new Map(
    walkFields(section.fieldTree.children, { includeDerived: true }).map((f) => [
      f.key,
      f,
    ])
  );

  for (const row of fields) {
    const def = defs.get(row.fieldKey);
    if (!def) continue;
    if (def.derive) {
      counts.readOnly += 1;
      continue;
    }
    counts.all += 1;
    switch (row.badge) {
      case "VALID":
        counts.valid += 1;
        break;
      case "PROVISIONAL":
        counts.provisional += 1;
        break;
      case "CONFLICT":
        counts.conflict += 1;
        break;
      case "MISSING":
        counts.missing += 1;
        break;
      case "READ_ONLY":
        counts.readOnly += 1;
        break;
      default:
        break;
    }
  }

  const requiredMissing = fields.filter(
    (f) => f.required && f.badge === "MISSING"
  ).length;

  return { chipCounts: counts, requiredMissing };
}