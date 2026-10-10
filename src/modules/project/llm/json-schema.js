import { z } from "zod";

/**
 * Convert a Zod schema to a JSON Schema Gemini can consume as responseSchema.
 * Gemini rejects $ref; Zod 4 inlines reused subschemas when reused: "inline".
 *
 * @param {import("zod").ZodType} schema
 * @returns {object}
 */
export function schemaToGeminiJsonSchema(schema) {
  const json = z.toJSONSchema(schema, {
    target: "openapi-3.0",
    reused: "inline",
    unrepresentable: "any",
  });

  return stripUnsupported(json);
}

function stripUnsupported(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(stripUnsupported);

  const {
    $schema,
    $id,
    $ref,
    $defs,
    definitions,
    additionalProperties,
    ...rest
  } = node;

  void $schema;
  void $id;
  void $ref;
  void $defs;
  void definitions;
  void additionalProperties;

  const out = {};
  for (const [key, value] of Object.entries(rest)) {
    if (key === "const" || key === "id" || key === "$anchor") continue;
    out[key] = stripUnsupported(value);
  }
  return out;
}
