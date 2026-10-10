import { z } from "zod";
import { LLMProvider } from "./provider.js";

/**
 * MockProvider — used in tests and local development without an API key.
 *
 * Set NUBRED_LLM_PROVIDER=mock in .env.
 */
export class MockProvider extends LLMProvider {
  constructor() {
    super();
    this._fixture = null;
    this.calls = [];
  }

  setFixture(data) {
    this._fixture = data;
  }

  async extract({ promptHash, userContent, schema }) {
    this.calls.push({
      type: "extract",
      promptHash,
      userContentLength: userContent.length,
      at: new Date().toISOString(),
    });

    if (this._fixture !== null) {
      const parsed = schema.safeParse(this._fixture);
      if (!parsed.success) {
        throw new Error(
          `MockProvider fixture failed schema validation: ${parsed.error.message}`
        );
      }
      return {
        data: parsed.data,
        usage: { inputTokens: 100, outputTokens: 50 },
        promptHash,
        modelId: "mock",
      };
    }

    return {
      data: buildNullObject(schema),
      usage: { inputTokens: 0, outputTokens: 0 },
      promptHash,
      modelId: "mock",
    };
  }

  async chat({ history, userMessage }) {
    this.calls.push({
      type: "chat",
      historyLength: history.length,
      userMessage,
      at: new Date().toISOString(),
    });

    return {
      text: `[MockProvider] Received: "${userMessage.slice(0, 80)}"`,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  reset() {
    this._fixture = null;
    this.calls = [];
  }
}

function buildNullObject(schema) {
  const json = z.toJSONSchema(schema, {
    target: "openapi-3.0",
    reused: "inline",
    unrepresentable: "any",
  });
  return fromJsonSchema(json);
}

function fromJsonSchema(node) {
  if (!node || typeof node !== "object") return null;

  if (node.anyOf || node.oneOf) {
    const alts = node.anyOf ?? node.oneOf;
    const nonNull = alts.find((item) => item && item.type !== "null");
    return nonNull ? fromJsonSchema(nonNull) : null;
  }

  if (node.type === "array") return [];
  if (node.type === "object" || node.properties) {
    const result = {};
    for (const [key, child] of Object.entries(node.properties ?? {})) {
      result[key] = fromJsonSchema(child);
    }
    return result;
  }
  if (node.type === "number" || node.type === "integer") return 0;
  if (node.type === "boolean") return false;
  if (node.nullable) return null;
  return null;
}
