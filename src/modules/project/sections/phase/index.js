import { makeSectionDefinition } from "../make-section.js";
import { phaseFieldTree } from "./phase.fields.js";
import { phaseRules } from "./phase.rules.js";

export const phaseSection = makeSectionDefinition({
  key: "phase",
  label: "Phases",
  order: 10,
  kind: "extractor",
  fieldTree: phaseFieldTree,
  rules: phaseRules,
});