import {
  acceptField,
  chooseCandidate,
  editField,
  gapField,
} from "../field-store/actions.js";
import { requireSectionKey } from "./load.js";
import { getSectionReview } from "./get-section.js";

const ACTIONS = new Set(["accept", "edit", "gap", "choose", "undo"]);

export async function applyFieldPatch(db, projectId, sectionKey, body, userId) {
  const action = body?.action;
  if (!ACTIONS.has(action)) {
    throw Object.assign(new Error(`Unknown field action "${action}".`), {
      code: 400,
    });
  }
  requireSectionKey(sectionKey);

  if (action === "choose") {
    if (!body?.candidateId) {
      throw Object.assign(new Error("candidateId is required for choose."), {
        code: 400,
      });
    }
    await chooseCandidate(db, { candidateId: body.candidateId, userId });
    return getSectionReview(db, projectId, sectionKey);
  }

  const recordId = body?.recordId;
  const fieldKey = body?.fieldKey;
  if (!recordId || !fieldKey) {
    throw Object.assign(new Error("recordId and fieldKey are required."), {
      code: 400,
    });
  }

  switch (action) {
    case "accept":
      await acceptField(db, { recordId, fieldKey, userId });
      break;
    case "edit":
      await editField(db, {
        projectId,
        sectionKey,
        recordId,
        fieldKey,
        value: body.value,
        userId,
        reason: body.reason,
      });
      break;
    case "gap":
      await gapField(db, { recordId, fieldKey, userId });
      break;
    case "undo":
      await db.fieldValue.update({
        where: { recordId_fieldKey: { recordId, fieldKey } },
        data: { review: "PENDING", reviewedById: null, reviewedAt: null },
      });
      break;
    default:
      break;
  }

  return getSectionReview(db, projectId, sectionKey);
}

/** Controller entry — v2 action-based PATCH body. */
export async function patchSectionField({
  db,
  projectId,
  sectionKey,
  userId,
  ...body
}) {
  return applyFieldPatch(db, projectId, sectionKey, body, userId);
}