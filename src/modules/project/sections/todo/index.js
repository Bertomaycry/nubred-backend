import { makeSectionDefinition } from "../make-section.js";
import { todoFieldTree } from "./todo.fields.js";
import { genericSectionRules } from "../_shared/generic.rules.js";

export const todoSection = makeSectionDefinition({
  key: "todo",
  label: "To-Do",
  order: 7,
  kind: "extractor",
  fieldTree: todoFieldTree,
  rules: genericSectionRules,
});