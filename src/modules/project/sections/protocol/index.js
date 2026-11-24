import { makeSectionDefinition } from "../make-section.js";
import { protocolFieldTree } from "./protocol.fields.js";
import { protocolRules } from "./protocol.rules.js";

export const protocolSection = makeSectionDefinition({
  key: "protocol",
  label: "Protocol",
  order: 8,
  kind: "extractor",
  fieldTree: protocolFieldTree,
  rules: protocolRules,
});