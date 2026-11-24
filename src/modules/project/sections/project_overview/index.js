import { makeSectionDefinition } from "../make-section.js";
import { projectOverviewFieldTree } from "./project_overview.fields.js";
import { genericSectionRules } from "../_shared/generic.rules.js";

export const projectOverviewSection = makeSectionDefinition({
  key: "project_overview",
  label: "Overview",
  order: 11,
  kind: "deriver",
  fieldTree: projectOverviewFieldTree,
  rules: genericSectionRules,
  perDocument: false,
});