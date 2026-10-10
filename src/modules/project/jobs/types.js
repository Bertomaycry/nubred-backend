/**
 * Job type strings stored on Job.type.
 *
 * EXTRACT_TEXT — mechanical page text (Step 3).
 * EXTRACT_SECTION — LLM structured extraction per section (Step 4).
 * DERIVE_CHRONOLOGY — aggregates dated events from extractor payloads (Step 4).
 */
export const JOB_TYPES = {
  EXTRACT_TEXT: "EXTRACT_TEXT",
  EXTRACT_SECTION: "EXTRACT_SECTION",
  DERIVE_CHRONOLOGY: "DERIVE_CHRONOLOGY",
};

export const JOB_TYPE_VALUES = Object.values(JOB_TYPES);
