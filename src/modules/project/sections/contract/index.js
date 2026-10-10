import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { contractExtractionSchema } from "./contract.schema.js";
import { contractRules } from "./contract.rules.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Contract section definition.
 *
 * kind: 'extractor' — directly reads uploaded documents and returns a structured JSON.
 *   (Compare: 'deriver', used by Chronology, which aggregates other sections' output.)
 *
 * relevantDocTypes: document type tags that should trigger (or be prioritised for)
 *   this section's extraction. The ingestion layer assigns document types at upload.
 *   A section may receive any document, but these types are the primary sources.
 *
 * promptDir: absolute path to the section's prompts/ directory.
 *   Files are loaded in sort order (00- → 20- → 30- → 40- → 90-).
 *   Prepended with framework layers by compose.js before sending to the LLM.
 */
export const contractSection = {
  key: "contract",
  label: "Contracts",

  /**
   * Default confirmation order — lower numbers are confirmed first.
   * Stored in the DB per project; the VM or admin can reorder at the project level.
   */
  order: 1,

  /**
   * 'extractor': runs an LLM extraction pass over uploaded documents.
   * 'deriver': aggregates structured output from other sections (no direct document read).
   */
  kind: "extractor",

  /** Whether this section is active in the current release. */
  enabled: true,

  /**
   * Zod schema for the extraction output.
   * Used for:
   *   1. Validating LLM output before persisting
   *   2. Generating JSON Schema for the LLM's structured output config
   *   3. Providing field descriptions as extraction instructions
   */
  schema: contractExtractionSchema,

  /** Confirmation blocking rules — enforced server-side in the review API (step 7). */
  rules: contractRules,

  /** Absolute path to the section's numbered prompt fragments. */
  promptDir: join(__dirname, "prompts"),

  /**
   * Document types that are primary sources for this section.
   * Used to score and prioritise document processing order.
   *
   * Values correspond to the document_type enum in the Document model (step 2).
   */
  relevantDocTypes: [
    "SIGNED_CONTRACT",
    "DRAFT_CONTRACT",
    "CONTRACT_ANNEX",
    "IP_CERTIFICATE",
    "EMAIL",             // Provisional confidence when royalty terms extracted from email
  ],
};
