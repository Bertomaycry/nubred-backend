import { composeCachedPrefix } from "../prompt/compose.js";

/** @type {Map<string, { hash: string, content: string }>} */
const prefixByKey = new Map();

/**
 * In-process prefix cache keyed by section + masterHash (Gemini explicit cache hook).
 */
export function getSectionPromptPrefix(sectionKey, masterContent, masterHash) {
  const key = `${sectionKey}:${masterHash}`;
  const hit = prefixByKey.get(key);
  if (hit) return hit;
  const built = composeCachedPrefix({ masterContent, masterHash });
  const payload = { hash: built.hash, content: built.content };
  prefixByKey.set(key, payload);
  return payload;
}

export function modelForStep(stepKind) {
  switch (stepKind) {
    case "triage":
      return (process.env.GEMINI_TRIAGE_MODEL ?? process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite").trim();
    case "contract":
      return (process.env.GEMINI_CONTRACT_MODEL ?? process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite").trim();
    default:
      return (process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite").trim();
  }
}