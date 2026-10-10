import { readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

/**
 * Prompt file loader with mtime-based cache.
 *
 * Keeps files in memory after first read. Invalidates per-file when the file's
 * last-modified timestamp changes (picks up prompt edits without a restart
 * during development, while staying fast in production).
 *
 * The hash stored on each entry is the SHA-256 of the file content.
 * Composed prompts hash the concatenation of their component hashes — so any
 * single-character change in any layer produces a different composed hash,
 * which is stored on the analysis run record for prompt version tracking.
 */

/** @type {Map<string, {content: string, hash: string, mtime: number}>} */
const _cache = new Map();

/**
 * Load a single markdown prompt file.
 *
 * @param {string} filePath - Absolute path to the .md file
 * @returns {{ content: string, hash: string }}
 */
export function loadPromptFile(filePath) {
  const mtime = statSync(filePath).mtimeMs;
  const cached = _cache.get(filePath);

  if (cached && cached.mtime === mtime) {
    return { content: cached.content, hash: cached.hash };
  }

  const content = readFileSync(filePath, "utf-8").trim();
  const hash = createHash("sha256").update(content).digest("hex");
  _cache.set(filePath, { content, hash, mtime });
  return { content, hash };
}

/**
 * Load all .md files in a directory, sorted by filename.
 * Numbered prefixes (00-, 20-, 30-…) give deterministic assembly order.
 *
 * @param {string} dirPath - Absolute path to the prompts directory
 * @returns {{ content: string, hash: string, files: string[] }}
 */
export function loadPromptDir(dirPath) {
  const files = readdirSync(dirPath)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => join(dirPath, f));

  const entries = files.map(loadPromptFile);
  const combined = entries.map((e) => e.content).join("\n\n");
  const combinedHash = createHash("sha256")
    .update(entries.map((e) => e.hash).join("|"))
    .digest("hex");

  return { content: combined, hash: combinedHash, files };
}

/** Invalidate the entire cache — useful in tests. */
export function clearPromptCache() {
  _cache.clear();
}
