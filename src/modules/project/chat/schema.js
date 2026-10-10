import { z } from "zod";

/**
 * Structured Gemini output for source / conflict / fill / apply turns.
 * Values are strings so the JSON Schema stays Gemini-friendly; the chat
 * runner JSON-parses them when possible.
 */
export const chatStructuredSchema = z.object({
  message: z
    .string()
    .describe("Plain assistant reply shown in the chat bubble. No markdown tables."),
  sources: z
    .array(
      z.object({
        document_name: z.string().describe("Exact filename as labelled in the corpus headers."),
        quote: z.string().describe("Short verbatim snippet (one or two sentences)."),
        page: z.number().int().nullable(),
      })
    )
    .describe("Citation cards. Empty array when none."),
  options: z
    .array(
      z.object({
        action: z.enum(["KEEP", "CHANGE"]),
        label: z.string().describe("Button label e.g. KEEP CHERRY or CHANGE TO APPLE."),
        value: z.string().describe("The field value this button would apply."),
      })
    )
    .describe("Conflict-resolution buttons. Empty unless resolving a conflict."),
  changes: z
    .array(
      z.object({
        field_path: z
          .string()
          .describe("snake_case path like primary_species_common or phases[0].plant_count."),
        field_label: z.string().describe("Short UI label e.g. Species."),
        previous_value: z.string().nullable(),
        new_value: z.string().nullable(),
      })
    )
    .describe("Fields to write. Empty when not applying a change."),
  found: z
    .boolean()
    .describe("For fill_missing: true if a value was found. False otherwise. True for apply_change."),
  warning: z
    .string()
    .nullable()
    .describe("Optional caution under the bubble. Null when none."),
});
