export const MODEL_UNAVAILABLE_MESSAGE =
  "The extraction model is temporarily unavailable. Nothing was saved for this section. Try again in a few minutes.";

/**
 * Short copy for a failed extraction step. Raw provider text stays in logs.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function userFacingStepError(raw) {
  const message = String(raw ?? "").trim();
  if (!message) return null;

  if (/503|Service Unavailable|high demand|temporarily unavailable/i.test(message)) {
    return MODEL_UNAVAILABLE_MESSAGE;
  }

  if (/429|quota|rate limit|too many requests/i.test(message)) {
    return "The extraction model quota was reached. Nothing was saved for this section. Wait a minute and try again.";
  }

  if (/Schema validation failed/i.test(message)) {
    return "The model returned data this section could not store. Nothing was saved.";
  }

  return message.length > 280 ? `${message.slice(0, 277)}...` : message;
}

/**
 * One line for ExtractionRun.error when any step failed.
 * @param {Array<{ sectionKey?: string, status?: string, error?: string | null }>} steps
 * @returns {string | null}
 */
export function runFailureSummary(steps) {
  const failed = (steps ?? []).filter((step) => step.status === "FAILED");
  if (!failed.length) return null;

  const sections = [...new Set(failed.map((step) => step.sectionKey).filter(Boolean))];
  const detail = userFacingStepError(failed[0].error);
  const countLabel =
    sections.length === 1
      ? "1 section could not be extracted."
      : `${sections.length} sections could not be extracted.`;

  return detail ? `${countLabel} ${detail}` : countLabel;
}

/**
 * Banner for one section after the latest run has finished.
 * @param {Array<{ sectionKey?: string, status?: string, error?: string | null }>} steps
 * @param {string} sectionKey
 * @param {number} chipAll
 * @param {string | null | undefined} runStatus
 * @returns {string | null}
 */
export function noticeForSection(steps, sectionKey, chipAll, runStatus) {
  const finished = runStatus === "SUCCEEDED" || runStatus === "PARTIAL" || runStatus === "FAILED";
  if (!finished) return null;

  const mine = (steps ?? []).filter((step) => step.sectionKey === sectionKey);
  const failed = mine.filter((step) => step.status === "FAILED");
  if (failed.length) return userFacingStepError(failed[0].error);

  if (!mine.length && chipAll === 0 && (runStatus === "PARTIAL" || runStatus === "FAILED")) {
    return "This section was not filled because extraction did not complete.";
  }

  const succeeded = mine.some((step) => step.status === "SUCCEEDED");
  if (succeeded && chipAll === 0) {
    return "Extraction finished and no fields were saved for this section.";
  }

  return null;
}
