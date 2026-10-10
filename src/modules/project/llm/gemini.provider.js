import { LLMProvider } from "./provider.js";
import { schemaToGeminiJsonSchema } from "./json-schema.js";

/**
 * GeminiProvider — wraps the Google Generative AI SDK.
 *
 * Requires env vars:
 *   GEMINI_API_KEY      — Google AI Studio / Vertex API key
 *   GEMINI_MODEL        — Model to use (default: gemini-3.5-flash-lite)
 *   GEMINI_RPM_LIMIT    — Local requests/min cap (default 12; free tier for
 *                         gemini-3.5-flash-lite is 15 RPM — stay under that)
 *
 * Rate limiting: a token-bucket cap (default 12 RPM). Calls within the
 * budget may run in parallel after the lead (contract) section finishes.
 *
 * IMPORTANT: Do not send real client contracts through the free tier.
 * Free-tier content may be used by Google to improve their models.
 * Use a paid key or the MockProvider for development against real documents.
 * See docs/PROJECT_STRUCTURE.md § LLM Provider.
 */

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
/** gemini-3.5-flash-lite free tier: 15 RPM — default below that leaves headroom. */
const DEFAULT_RPM = 12;

const TOKEN_BUCKET = {
  requests: 0,
  windowStart: Date.now(),
  maxPerMinute: parseInt(process.env.GEMINI_RPM_LIMIT ?? String(DEFAULT_RPM), 10),
};

function releaseRateLimitSlot() {
  TOKEN_BUCKET.requests = Math.max(0, TOKEN_BUCKET.requests - 1);
}

/**
 * Parse Google's 429 RetryInfo from SDK error text.
 * @param {string} message
 * @returns {number | null} milliseconds
 */
export function parseGeminiRetryAfterMs(message) {
  const retryInMatch = message.match(/retry in ([\d.]+)s/i);
  if (retryInMatch) {
    return Math.ceil(parseFloat(retryInMatch[1]) * 1000) + 1000;
  }

  const retryDelayMatch = message.match(/"retryDelay"\s*:\s*"(\d+)s"/);
  if (retryDelayMatch) {
    return (parseInt(retryDelayMatch[1], 10) + 1) * 1000;
  }

  return null;
}

/**
 * Convert Google quota / 429 errors into RATE_LIMIT for the job worker.
 * @param {unknown} err
 * @returns {Error}
 */
export function normalizeGeminiError(err) {
  const message = err?.message || String(err);
  const isQuota =
    message.includes("429") ||
    message.includes("Too Many Requests") ||
    message.includes("quota") ||
    message.includes("Quota exceeded");

  if (!isQuota) {
    return err instanceof Error ? err : new Error(message);
  }

  releaseRateLimitSlot();

  const retryAfterMs = parseGeminiRetryAfterMs(message) ?? 25_000;
  return Object.assign(
    new Error(
      `Gemini quota exceeded. Retry after ${Math.ceil(retryAfterMs / 1000)}s.`
    ),
    { code: "RATE_LIMIT", retryAfterMs }
  );
}

async function acquireRateSlot() {
  const now = Date.now();
  if (now - TOKEN_BUCKET.windowStart > 60_000) {
    TOKEN_BUCKET.requests = 0;
    TOKEN_BUCKET.windowStart = now;
  }

  if (TOKEN_BUCKET.requests >= TOKEN_BUCKET.maxPerMinute) {
    const waitMs = 60_000 - (now - TOKEN_BUCKET.windowStart);
    throw Object.assign(
      new Error(`Gemini rate limit reached. Retry after ${Math.ceil(waitMs / 1000)}s.`),
      { code: "RATE_LIMIT", retryAfterMs: waitMs }
    );
  }

  TOKEN_BUCKET.requests++;
}

export class GeminiProvider extends LLMProvider {
  constructor() {
    super();
    if (!process.env.GEMINI_API_KEY?.trim()) {
      throw new Error(
        "GEMINI_API_KEY environment variable is not set. " +
          "Set NUBRED_LLM_PROVIDER=mock for development without an API key."
      );
    }
    this._apiKey = process.env.GEMINI_API_KEY.trim();
    this._modelId = (process.env.GEMINI_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  }

  async _getClient() {
    if (!this._sdk) {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      this._sdk = new GoogleGenerativeAI(this._apiKey);
    }
    return this._sdk;
  }

  async extract({ systemPrompt, promptHash, userContent, schema }) {
    await acquireRateSlot();

    try {
      const sdk = await this._getClient();
      const jsonSchema = schemaToGeminiJsonSchema(schema);

      const model = sdk.getGenerativeModel({
        model: this._modelId,
        systemInstruction: systemPrompt,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: jsonSchema,
          temperature: 0.1,
          maxOutputTokens: 16384,
        },
      });

      const result = await model.generateContent(userContent);
      const response = result.response;
      const text = response.text();
      const usage = response.usageMetadata ?? {};

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `Gemini returned non-JSON response for model ${this._modelId}. ` +
            `First 200 chars: ${text.slice(0, 200)}`
        );
      }

      return {
        data,
        usage: {
          inputTokens: usage.promptTokenCount ?? 0,
          outputTokens: usage.candidatesTokenCount ?? 0,
          cachedInputTokens: usage.cachedContentTokenCount ?? 0,
        },
        promptHash,
        modelId: this._modelId,
      };
    } catch (err) {
      if (!err.message?.startsWith("Gemini returned non-JSON")) {
        releaseRateLimitSlot();
      }
      throw normalizeGeminiError(err);
    }
  }

  async chat({ systemPrompt, history, userMessage }) {
    await acquireRateSlot();

    try {
      const sdk = await this._getClient();

      const model = sdk.getGenerativeModel({
        model: this._modelId,
        systemInstruction: systemPrompt,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
        },
      });

      const chat = model.startChat({
        history: history.map((msg) => ({
          role: msg.role === "model" ? "model" : "user",
          parts: [{ text: msg.content }],
        })),
      });

      const result = await chat.sendMessage(userMessage);
      const response = result.response;
      const usage = response.usageMetadata ?? {};

      return {
        text: response.text(),
        usage: {
          inputTokens: usage.promptTokenCount ?? 0,
          outputTokens: usage.candidatesTokenCount ?? 0,
        },
      };
    } catch (err) {
      releaseRateLimitSlot();
      throw normalizeGeminiError(err);
    }
  }
}
