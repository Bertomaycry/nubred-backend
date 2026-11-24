import { makeSectionDefinition } from "../make-section.js";
import { genotypeFieldTree } from "./genotype.fields.js";
import { genotypeRules } from "./genotype.rules.js";

export const genotypeSection = makeSectionDefinition({
  key: "genotype",
  label: "Genotype",
  order: 2,
  kind: "extractor",
  fieldTree: genotypeFieldTree,
  rules: genotypeRules,
});