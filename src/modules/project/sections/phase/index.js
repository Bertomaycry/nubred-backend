import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { phaseExtractionSchema } from "./phase.schema.js";
import { phaseRules } from "./phase.rules.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const phaseSection = {
  key: "phase",
  label: "Phases",
  order: 3,
  kind: "extractor",
  enabled: true,
  schema: phaseExtractionSchema,
  rules: phaseRules,
  promptDir: join(__dirname, "prompts"),
  relevantDocTypes: [
    "SIGNED_CONTRACT",
    "DRAFT_CONTRACT",
    "CONTRACT_ANNEX",
    "PROTOCOL_DOCUMENT",
    "MEETING_NOTES",
    "EMAIL",
  ],
};
