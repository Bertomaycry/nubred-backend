import { z } from "zod";
import { isGroup, walkFields } from "./traverse.js";

export const fieldValueSchema = z.object({
  value: z
    .union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.union([z.string(), z.number()])),
      z.null(),
    ])
    .nullable(),
  status: z.enum(["found", "not_found", "not_applicable"]),
  quote: z.string().nullable().optional(),
  page: z.number().int().positive().nullable().optional(),
});

/** Gemini rejects "" as an enum value; the merge maps this back to "". */
export const ROOT_GROUP_PATH = "root";

/**
 * Gemini drops `additionalProperties`, so `fields` must name every key or the
 * model is handed an object with no allowed properties.
 * @param {string[]} groupPaths
 * @param {string[]} fieldKeys
 */
function recordSchemaFor(groupPaths, fieldKeys) {
  return z.object({
    ref: z.string().uuid().nullable().describe("Existing record id, or null for NEW."),
    group_path: (groupPaths.length ? z.enum(groupPaths) : z.string()).describe(
      `Group path from the section tree. Use "${ROOT_GROUP_PATH}" for top-level fields.`
    ),
    parent_record_ref: z.string().uuid().nullable().optional(),
    fields: z.object(
      Object.fromEntries(fieldKeys.map((key) => [key, fieldValueSchema.optional()]))
    ),
  });
}

/**
 * @param {import("./types.js").SectionFieldTree} tree
 * @param {{ partIndex?: number }} [opts]
 */
export function buildExtractionZodSchema(tree, opts = {}) {
  const partIndex = opts.partIndex;
  let nodes = tree.children;
  if (partIndex != null && tree.extractionParts?.[partIndex]) {
    nodes = tree.extractionParts[partIndex].nodes;
  }

  const extractable = walkFields(nodes, { includeDerived: false });
  const fieldKeys = [...new Set(extractable.map((f) => f.key))];
  const groupPaths = [
    ...new Set(extractable.map((f) => f._groupPath ?? ROOT_GROUP_PATH)),
  ];

  return z.object({
    records: z
      .array(recordSchemaFor(groupPaths, fieldKeys))
      .describe(
        `Proposed records for section ${tree.sectionKey}. Field keys in this part: ${fieldKeys.join(", ")}.`
      ),
  });
}