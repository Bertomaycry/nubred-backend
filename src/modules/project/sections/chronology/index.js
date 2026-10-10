import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chronologyExtractionSchema } from "./chronology.schema.js";
import { chronologyRules } from "./chronology.rules.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const chronologySection = {
  key: "chronology",
  label: "Chronology",
  order: 5,

  /**
   * Chronology is a DERIVER — it does not run its own LLM extraction pass.
   * Instead, the pipeline calls derive() after all extractor sections complete:
   *   1. Aggregates dated events from Contract, Genotype, Phase, Protocol output.
   *   2. Runs a light document-metadata sweep for any remaining dated events.
   *
   * The derive() function will be implemented in Step 9 (canonical promotion).
   * The schema and rules are active from day one.
   */
  kind: "deriver",

  enabled: true,
  schema: chronologyExtractionSchema,
  rules: chronologyRules,

  /**
   * promptDir is used for the section AI chat (to answer timeline questions),
   * not for a standalone extraction run.
   */
  promptDir: join(__dirname, "prompts"),

  /**
   * Derivers don't have relevant doc types in the same sense as extractors.
   * This list is used for the chat's document retrieval scope.
   */
  relevantDocTypes: [
    "SIGNED_CONTRACT",
    "DRAFT_CONTRACT",
    "CONTRACT_ANNEX",
    "IP_CERTIFICATE",
    "MEETING_NOTES",
    "EMAIL",
    "PROTOCOL_DOCUMENT",
  ],
};
