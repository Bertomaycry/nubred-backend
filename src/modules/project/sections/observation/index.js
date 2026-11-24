import { makeSectionDefinition } from "../make-section.js";
import { observationFieldTree } from "./observation.fields.js";
import { genericSectionRules } from "../_shared/generic.rules.js";

export const observationSection = makeSectionDefinition({
  key: "observation",
  label: "Observation",
  order: 9,
  kind: "extractor",
  fieldTree: observationFieldTree,
  rules: genericSectionRules,
});