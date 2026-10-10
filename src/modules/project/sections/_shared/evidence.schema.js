import { z } from "zod";

/**
 * Every substantive extracted value must be backed by at least one evidence entry.
 * Field paths use dot notation: 'parties[0].name', 'financial_terms.royalty_structure'.
 *
 * This schema is imported by every section schema — it is the single source of truth
 * for the Why Button data that the VM sees on every extracted field.
 */
export const evidenceItemSchema = z.object({
  field_path: z
    .string()
    .describe(
      "Dot-notation path to the field this evidence supports. " +
        "Examples: 'parties[0].name', 'financial_terms.royalty_structure', 'phases[1].gate_criteria[0]'."
    ),
  document_name: z
    .string()
    .describe("File name of the source document exactly as uploaded."),
  page: z
    .number()
    .int()
    .nullable()
    .describe("1-based page number in the source document. Null for plain-text or email sources with no pagination."),
  char_offset: z
    .number()
    .int()
    .nullable()
    .describe(
      "Character offset of the start of the cited passage within the extracted document text. " +
        "Used for precise highlighting. Null if unavailable."
    ),
  quote: z
    .string()
    .describe(
      "Exact verbatim passage from the document that supports the extracted value. " +
        "Do not paraphrase. Preserve original language even if non-English."
    ),
  framework_element: z
    .string()
    .nullable()
    .describe(
      "The NuBred Glossary term, phase definition, or AgreeLyze clause ID that " +
        "guided the mapping from the source text to the NuBred field. " +
        "Example: 'Glossary: Variety', 'Clause: C-07 Minimum Quantities', 'Phase: Trial'."
    ),
});

/** Shared evidence array used at the top level of every section extraction output. */
export const evidenceArraySchema = z
  .array(evidenceItemSchema)
  .describe(
    "Source citations for every substantive extracted value. " +
      "One entry per piece of evidence — a single field may have multiple entries if supported by more than one document. " +
      "A field with no evidence entry will be treated as unverifiable and flagged for VM review."
  );
