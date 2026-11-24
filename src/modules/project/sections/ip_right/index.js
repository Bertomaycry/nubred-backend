import { makeSectionDefinition } from "../make-section.js";
import { ipRightFieldTree } from "./ip_right.fields.js";
import { genericSectionRules } from "../_shared/generic.rules.js";

export const ipRightSection = makeSectionDefinition({
  key: "ip_right",
  label: "IP Rights",
  order: 3,
  kind: "extractor",
  fieldTree: ipRightFieldTree,
  rules: genericSectionRules,
});