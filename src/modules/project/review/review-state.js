import prisma from "../../../lib/prisma.js";
import { requireSectionKey, requireSucceededDraft } from "./load.js";

const ALLOWED_KEYS = new Set(["gapsTabViewed"]);

/**
 * Merge review-state flags on the latest SUCCEEDED draft.
 * Contract confirmation requires gapsTabViewed === true (see contract.rules.js).
 */
export async function patchReviewState({ projectId, sectionKey, patch }) {
  requireSectionKey(sectionKey);
  const row = await requireSucceededDraft(projectId, sectionKey);

  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw Object.assign(new Error("Body must be a JSON object."), { code: 400 });
  }

  const next = {
    ...(row.reviewState && typeof row.reviewState === "object" ? row.reviewState : {}),
  };

  let touched = false;
  for (const [key, value] of Object.entries(patch)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw Object.assign(
        new Error(
          `Unknown review-state key "${key}". Allowed: ${[...ALLOWED_KEYS].join(", ")}.`
        ),
        { code: 400 }
      );
    }
    if (typeof value !== "boolean") {
      throw Object.assign(
        new Error(`review-state.${key} must be a boolean.`),
        { code: 400 }
      );
    }
    next[key] = value;
    touched = true;
  }

  if (!touched) {
    throw Object.assign(
      new Error("Provide at least one review-state flag (e.g. gapsTabViewed)."),
      { code: 400 }
    );
  }

  return prisma.sectionExtraction.update({
    where: { id: row.id },
    data: { reviewState: next },
    include: {
      evidenceItems: { orderBy: { fieldPath: "asc" } },
    },
  });
}
