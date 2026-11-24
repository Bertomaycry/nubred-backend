import { makeSectionDefinition } from "../make-section.js";
import { timelineFieldTree } from "./timeline.fields.js";
import { genericSectionRules } from "../_shared/generic.rules.js";

export const timelineSection = makeSectionDefinition({
  key: "timeline",
  label: "Timeline",
  order: 6,
  kind: "hybrid",
  fieldTree: timelineFieldTree,
  rules: genericSectionRules,
  contractOnly: true,
});