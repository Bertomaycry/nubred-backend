import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { genotypeExtractionSchema } from "./genotype.schema.js";
import { genotypeRules } from "./genotype.rules.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const genotypeSection = {
  key: "genotype",
  label: "Genotype",
  order: 2,
  kind: "extractor",
  enabled: true,
  schema: genotypeExtractionSchema,
  rules: genotypeRules,
  promptDir: join(__dirname, "prompts"),
  relevantDocTypes: [
    "SIGNED_CONTRACT",
    "DRAFT_CONTRACT",
    "PROTOCOL_DOCUMENT",
    "PLANTING_PLAN",
    "IP_CERTIFICATE",
    "EMAIL",
  ],
};
