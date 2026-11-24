import { makeSectionDefinition } from "../make-section.js";
import { supplyChainFieldTree } from "./supply_chain.fields.js";
import { genericSectionRules } from "../_shared/generic.rules.js";

export const supplyChainSection = makeSectionDefinition({
  key: "supply_chain",
  label: "Companies & Supply Chain",
  order: 4,
  kind: "extractor",
  fieldTree: supplyChainFieldTree,
  rules: genericSectionRules,
});