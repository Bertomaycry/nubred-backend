import { buildExtractionZodSchema, toDefinitionTree } from "./field-tree/index.js";
import { genericSectionRules } from "./_shared/generic.rules.js";

/**
 * @param {{
 *   key: string,
 *   label: string,
 *   order: number,
 *   kind: 'extractor'|'deriver'|'hybrid',
 *   enabled?: boolean,
 *   fieldTree: import("./field-tree/types.js").SectionFieldTree,
 *   rules?: object,
 *   perDocument?: boolean,
 *   contractOnly?: boolean,
 * }} params
 */
export function makeSectionDefinition(params) {
  const {
    key,
    label,
    order,
    kind,
    enabled = true,
    fieldTree,
    rules = genericSectionRules,
    perDocument = true,
    contractOnly = false,
  } = params;

  const hasParts = Boolean(fieldTree.extractionParts?.length);
  const partCount = hasParts ? fieldTree.extractionParts.length : 1;
  const schemas = [];
  for (let i = 0; i < partCount; i++) {
    schemas.push(buildExtractionZodSchema(fieldTree, hasParts ? { partIndex: i } : {}));
  }

  return {
    key,
    label,
    order,
    kind,
    enabled,
    fieldTree,
    definition: toDefinitionTree(fieldTree.children),
    schema: schemas[0],
    extractionSchemas: schemas,
    extractionPartCount: partCount,
    rules,
    promptDir: null,
    perDocument,
    contractOnly,
    contextFields: fieldTree.contextFields ?? [],
  };
}