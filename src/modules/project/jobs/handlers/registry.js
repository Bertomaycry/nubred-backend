import { JOB_TYPES } from "../types.js";
import { handleExtractText, onExtractTextDead } from "./extract-text.js";
import { handleExtractSection, onExtractSectionDead } from "./extract-section.js";
import {
  handleDeriveChronology,
  onDeriveChronologyDead,
} from "./derive-chronology.js";

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
  [JOB_TYPES.EXTRACT_SECTION]: {
    run: handleExtractSection,
    onDead: onExtractSectionDead,
  },
  [JOB_TYPES.DERIVE_CHRONOLOGY]: {
    run: handleDeriveChronology,
    onDead: onDeriveChronologyDead,
  },
};

/**
 * @param {string} type
 * @returns {JobHandler | null}
 */
export function getHandler(type) {
  return handlers[type] ?? null;
}
