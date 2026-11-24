import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CORE_RULES = readFileSync(join(__dirname, "core-rules.md"), "utf8");
const OUTPUT_RULES = readFileSync(join(__dirname, "output-rules.md"), "utf8");

const USER_PREVAILS =
  "When the project user filter below conflicts with master filters, follow the user filter.";

/**
 * Static prefix cached per section + masterHash (Gemini context cache).
 * @param {{ masterContent: string, masterHash: string }} params
 */
export function composeCachedPrefix({ masterContent, masterHash }) {
  const parts = [
    CORE_RULES,
    "## Master filters",
    masterContent || "(No master filters uploaded for this section yet.)",
    OUTPUT_RULES,
  ];
  const content = parts.join("\n\n");
  const hash = createHash("sha256")
    .update(masterHash + "|" + content)
    .digest("hex");
  return { content, hash };
}

/**
 * Full extraction system prompt (prefix + optional user filter).
 */
export function composeExtractionPrompt({
  masterContent,
  masterHash,
  userFilterText,
}) {
  const prefix = composeCachedPrefix({ masterContent, masterHash });
  const dynamic = userFilterText?.trim()
    ? [USER_PREVAILS, "## Project user filter", userFilterText.trim()].join("\n\n")
    : "";

  const content = dynamic
    ? [prefix.content, dynamic].join("\n\n---\n\n")
    : prefix.content;

  const hash = createHash("sha256")
    .update(prefix.hash + "|" + (dynamic ? "user" : "none"))
    .digest("hex");

  return { content, hash, prefixHash: prefix.hash };
}

/**
 * Document triage — cheap pass before per-section extraction.
 */
export function composeTriagePrompt({ masterOverview }) {
  const content = [
    CORE_RULES,
    "## Triage task",
    "Classify this document: type, document date (ISO or best effort), signed (boolean), related contract record id if inferable from context (uuid or null), and which section keys are relevant.",
    "Set detectedType to exactly one of: CONTRACT, ANNEX_ADDENDUM, PROTOCOL, OFFICIAL_RECORD, CORRESPONDENCE, OTHER. A licence, license, or other agreement is CONTRACT. An annex, addendum, or side letter is ANNEX_ADDENDUM. A trial or cultivation protocol is PROTOCOL. An IP certificate, permit, or register extract is OFFICIAL_RECORD. An email or meeting notes is CORRESPONDENCE. Anything else is OTHER. Do not put signed or draft into the type. Set signed true only when a signature date is present.",
    masterOverview ?? "",
  ].join("\n\n");

  const hash = createHash("sha256").update(content).digest("hex");
  return { content, hash };
}

/** @deprecated v1 section prompt dirs — use composeExtractionPrompt */
export function composeSystemPrompt() {
  throw new Error(
    "composeSystemPrompt(sectionPromptDir) is retired. Use composeExtractionPrompt()."
  );
}

export function composeChatSystemPrompt(roleMdPath) {
  const role = readFileSync(roleMdPath, "utf8");
  const content = [CORE_RULES, role].join("\n\n---\n\n");
  const hash = createHash("sha256").update(content).digest("hex");
  return { content, hash };
}