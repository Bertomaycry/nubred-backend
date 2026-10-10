import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { protocolExtractionSchema } from "./protocol.schema.js";
import { protocolRules } from "./protocol.rules.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const protocolSection = {
  key: "protocol",
  label: "Protocols",
  order: 4,
  kind: "extractor",
  enabled: true,
  schema: protocolExtractionSchema,
  rules: protocolRules,
  promptDir: join(__dirname, "prompts"),
  relevantDocTypes: [
    "PROTOCOL_DOCUMENT",
    "CONTRACT_ANNEX",     // Protocols often appear in trial agreement annexes
    "VCU_EVALUATION",
    "SIGNED_CONTRACT",
  ],
};
