import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPromptDir, loadPromptFile } from "./loader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Path to the three static framework layers:
 *   glossary.md          — NuBred Domain Glossary (Doc E)
 *   phase-framework.md   — Standard phases, gate criteria, phase terminology mapping
 *   clause-library.md    — 45 AgreeLyze standard clause categories
 *
 * These are IDENTICAL on every extraction call and should be the first tokens
 * in the prompt so provider-side caching (Gemini context cache, Anthropic
 * prompt cache) covers them.
 */
const FRAMEWORK_DIR = join(__dirname, "../framework/prompts");

// Pre-load framework layers at module load time — they never change at runtime.
// Stored in a module-level variable so `composeSystemPrompt` is synchronous.
let _frameworkLayer = null;

function getFrameworkLayer() {
  if (!_frameworkLayer) {
    _frameworkLayer = loadPromptDir(FRAMEWORK_DIR);
  }
  return _frameworkLayer;
}

/**
 * Compose the full system prompt for a section extraction run.
 *
 * Layer order (static → dynamic):
 *   1. Framework (Glossary + Phase Framework + Clause Library) — cacheable prefix
 *   2. Section prompt fragments from the section's prompts/ directory
 *
 * @param {string} sectionPromptDir - Absolute path to the section's prompts/ directory
 * @returns {{ content: string, hash: string }}
 *   content — the assembled system prompt string to send to the LLM
 *   hash    — SHA-256 of the composed prompt, stored on the run record for versioning
 */
export function composeSystemPrompt(sectionPromptDir) {
  const framework = getFrameworkLayer();
  const section = loadPromptDir(sectionPromptDir);

  const content = [framework.content, section.content].join(
    "\n\n---\n\n"
  );

  const hash = createHash("sha256")
    .update(framework.hash + "|" + section.hash)
    .digest("hex");

  return { content, hash };
}

/**
 * Compose a section chat system prompt.
 *
 * The chat prompt is a lighter version — it includes the framework layers
 * for domain grounding but omits the heavy obligation-map and classification
 * fragments that are only needed for full extraction.
 *
 * For the chat, the section's 00-role.md and 90-output-rules.md are sufficient.
 * Additional context (document text excerpts, current confirmed values) is
 * injected as user-turn context by the chat controller, not here.
 *
 * @param {string} roleMdPath   - Absolute path to the section's 00-role.md
 * @returns {{ content: string, hash: string }}
 */
export function composeChatSystemPrompt(roleMdPath) {
  const framework = getFrameworkLayer();
  const role = loadPromptFile(roleMdPath);

  const content = [framework.content, role.content].join("\n\n---\n\n");
  const hash = createHash("sha256")
    .update(framework.hash + "|" + role.hash)
    .digest("hex");

  return { content, hash };
}

/** Force-reload the framework layer (e.g. after editing prompt files in tests). */
export function invalidateFrameworkCache() {
  _frameworkLayer = null;
}
