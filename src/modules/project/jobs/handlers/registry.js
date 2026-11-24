import { JOB_TYPES } from "../types.js";
import { handleExtractText, onExtractTextDead } from "./extract-text.js";
import { handleTriageDocument, onTriageDocumentDead } from "./triage-document.js";
import { handleExtractStep, onExtractStepDead } from "./extract-step.js";
import { handleDeriveSections, onDeriveSectionsDead } from "./derive-sections.js";

/**
 * @typedef {Object} JobHandler
 * @property {(job: object) => Promise<void>} run
 * @property {(job: object, errorMessage: string) => Promise<void>} [onDead]
 */

/** @type {Record<string, JobHandler>} */
const handlers = {
  [JOB_TYPES.EXTRACT_TEXT]: {
    run: handleExtractText,
    onDead: onExtractTextDead,
  },
  [JOB_TYPES.TRIAGE_DOCUMENT]: {
    run: handleTriageDocument,
    onDead: onTriageDocumentDead,
  },
  [JOB_TYPES.EXTRACT_STEP]: {
    run: handleExtractStep,
    onDead: onExtractStepDead,
  },
  [JOB_TYPES.DERIVE_SECTIONS]: {
    run: handleDeriveSections,
    onDead: onDeriveSectionsDead,
  },
};

/**
 * @param {string} type
 * @returns {JobHandler | null}
 */
export function getHandler(type) {
  return handlers[type] ?? null;
}