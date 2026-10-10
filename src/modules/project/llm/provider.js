/**
 * LLMProvider — the single interface all AI calls go through.
 *
 * Concrete implementations: GeminiProvider (default), MockProvider (tests/dev).
 * All AI calls MUST go through ensureProvider()/getProvider() — never call a
 * vendor SDK outside this module.
 */

/**
 * @typedef {Object} ExtractionResult
 * @property {unknown}  data
 * @property {Usage}    usage
 * @property {string}   promptHash
 * @property {string}   modelId
 */

/**
 * @typedef {Object} Usage
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {number} [cachedInputTokens]
 */

export class LLMProvider {
  // eslint-disable-next-line no-unused-vars
  async extract({ systemPrompt, promptHash, userContent, schema }) {
    throw new Error(`${this.constructor.name} must implement extract()`);
  }

  // eslint-disable-next-line no-unused-vars
  async chat({ systemPrompt, history, userMessage }) {
    throw new Error(`${this.constructor.name} must implement chat()`);
  }
}

/** @type {LLMProvider | null} */
let _activeProvider = null;

/** @type {Promise<LLMProvider> | null} */
let _initPromise = null;

/** @type {Error | null} */
let _initError = null;

function providerName() {
  return (process.env.NUBRED_LLM_PROVIDER ?? "gemini").trim().toLowerCase();
}

/**
 * Async initialisation — call at app startup. Idempotent.
 * @returns {Promise<LLMProvider>}
 */
export async function initProvider() {
  if (_activeProvider) return _activeProvider;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const name = providerName();
    switch (name) {
      case "gemini": {
        const { GeminiProvider } = await import("./gemini.provider.js");
        _activeProvider = new GeminiProvider();
        break;
      }
      case "mock": {
        const { MockProvider } = await import("./mock.provider.js");
        _activeProvider = new MockProvider();
        break;
      }
      default:
        throw new Error(
          `Unknown NUBRED_LLM_PROVIDER value: "${name}". ` +
            `Supported values: 'gemini', 'mock'.`
        );
    }
    _initError = null;
    return _activeProvider;
  })();

  try {
    return await _initPromise;
  } catch (error) {
    _initError = error;
    _initPromise = null;
    throw error;
  }
}

/**
 * Returns the provider, initialising on first use if startup init failed.
 * @returns {Promise<LLMProvider>}
 */
export async function ensureProvider() {
  if (_activeProvider) return _activeProvider;
  try {
    return await initProvider();
  } catch (error) {
    throw Object.assign(
      new Error(
        `LLM provider unavailable: ${error.message}. ` +
          `Set NUBRED_LLM_PROVIDER=mock for local development without a key, ` +
          `or set GEMINI_API_KEY for Gemini.`
      ),
      { code: 503 }
    );
  }
}

/**
 * Synchronous accessor after initProvider()/ensureProvider().
 * @returns {LLMProvider}
 */
export function getProvider() {
  if (!_activeProvider) {
    const detail = _initError?.message
      ? ` Last error: ${_initError.message}`
      : " Call initProvider() at application startup.";
    throw new Error(`LLM provider is not initialised.${detail}`);
  }
  return _activeProvider;
}

/**
 * Override the active provider — used in tests.
 * @param {LLMProvider | null} provider
 */
export function setProvider(provider) {
  _activeProvider = provider;
  _initError = null;
  _initPromise = null;
}
