import { makeSectionDefinition } from "../make-section.js";
import { quarantineFieldTree } from "./quarantine.fields.js";
import { genericSectionRules } from "../_shared/generic.rules.js";

export const quarantineSection = makeSectionDefinition({
  key: "quarantine",
  label: "Quarantine",
  order: 5,
  kind: "extractor",
  fieldTree: quarantineFieldTree,
  rules: genericSectionRules,
});