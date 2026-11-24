import { normalizeDocumentKind } from "../storage/allowed.js";
import { getReadingOrderSections } from "../sections/registry.js";
import {
  enabledSectionKeys,
  isSectionEnabled,
} from "../access/section-modules.js";

/**
 * Build ordered extraction steps: each enabled per-document section × each document.
 * @param {{ documentIds: string[], enabledModules: Set<string>, relevantByDoc?: Map<string, string[]> }} params
 */
export function planExtractionSteps({ documentIds, enabledModules, relevantByDoc }) {
  const sections = getReadingOrderSections(enabledSectionKeys(enabledModules));

  /** @type {Array<{ documentId: string, sectionKey: string, partIndex: number }>} */
  const steps = [];

  for (const documentId of documentIds) {
    const relevant = new Set(relevantByDoc?.get(documentId) ?? []);
    for (const section of sections) {
      if (!isSectionEnabled(section.key, enabledModules) && section.key !== "project_overview") {
        continue;
      }
      if (section.perDocument === false) continue;
      if (relevant.size && !relevant.has(section.key)) continue;

      const partCount = section.extractionPartCount ?? 1;
      for (let partIndex = 0; partIndex < partCount; partIndex++) {
        steps.push({ documentId, sectionKey: section.key, partIndex });
      }
    }
  }

  return steps;
}

export function triageRelevantForSection(sectionKey, document) {
  const sections = document.relevantSections;
  if (Array.isArray(sections)) return sections.includes(sectionKey);
  return true;
}

const CONTRACT_KINDS = new Set(["CONTRACT", "ANNEX_ADDENDUM"]);

/**
 * Contract or annex/addendum. A signed protocol stays a protocol.
 * Free-text labels such as "licence agreement" still map to CONTRACT.
 * @param {{ detectedType?: string | null, documentType?: string | null }} document
 */
export function isContractDocument(document) {
  const kinds = [document?.detectedType, document?.documentType]
    .map((value) => normalizeDocumentKind(value))
    .filter(Boolean);
  return kinds.some((kind) => CONTRACT_KINDS.has(kind));
}

/**
 * Contract and timeline steps.
 * `skip` only after triage has classified the file as something else.
 * `unclassified` means triage never finished, so the file is not "not a contract".
 * @param {{ contractOnly?: boolean }} section
 * @param {{ triagedAt?: Date | string | null }} document
 * @returns {"run" | "skip" | "unclassified"}
 */
export function contractOnlyDecision(section, document) {
  if (!section?.contractOnly || isContractDocument(document)) return "run";
  if (!document?.triagedAt) return "unclassified";
  return "skip";
}

export function contractOnlySkip(section, document) {
  return contractOnlyDecision(section, document) === "skip";
}