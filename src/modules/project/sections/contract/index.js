import { makeSectionDefinition } from "../make-section.js";
import { contractFieldTree } from "./contract.fields.js";
import { contractRules } from "./contract.rules.js";

export const contractSection = makeSectionDefinition({
  key: "contract",
  label: "Contract",
  order: 1,
  kind: "extractor",
  fieldTree: contractFieldTree,
  rules: contractRules,
  perDocument: true,
  contractOnly: true,
});