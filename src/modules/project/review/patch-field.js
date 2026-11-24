import {
  acceptField,
  addRecord,
  chooseCandidate,
  editField,
  gapField,
} from "../field-store/actions.js";
import { ensureSectionState } from "../field-store/repository.js";
import { listGroups, walkFields } from "../sections/field-tree/traverse.js";
import { requireSectionKey } from "./load.js";
import { getSectionReview } from "./get-section.js";

const ACTIONS = new Set(["accept", "edit", "gap", "choose", "undo"]);
const WRITE_WITHOUT_RECORD = new Set(["edit", "gap"]);
export const MAX_BATCH_ACTIONS = 500;
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 60_000 };

function badRequest(message) {
  return Object.assign(new Error(message), { code: 400 });
}

/**
 * Single record for a non-repeatable group (or the root, groupPath "").
 * Repeatable groups need a create-record endpoint first.
 */
async function resolveGroupRecord(
  tx,
  { projectId, section, groupPath, parentRecordId, fieldKey }
) {
  const groups = listGroups(section.fieldTree.children);
  if (groupPath !== "") {
    const group = groups.find((g) => g.path === groupPath);
    if (!group) throw badRequest(`Unknown groupPath "${groupPath}" for this section.`);
    if (group.repeatable) {
      throw badRequest(
        `"${groupPath}" is a repeatable group. Send a recordId for an existing record.`
      );
    }
    const repeatableAncestor = groups.some(
      (g) => g.repeatable && groupPath.startsWith(`${g.path}.`)
    );
    if (repeatableAncestor && !parentRecordId) {
      throw badRequest(`parentRecordId is required for groupPath "${groupPath}".`);
    }
  }
  requireFieldInGroup(section, groupPath, fieldKey);

  if (parentRecordId) {
    const parent = await tx.sectionRecord.findFirst({
      where: { id: parentRecordId, projectId, sectionKey: section.key, deletedAt: null },
      select: { id: true },
    });
    if (!parent) throw badRequest("parentRecordId is not a record in this section.");
  }

  const existing = await tx.sectionRecord.findFirst({
    where: {
      projectId,
      sectionKey: section.key,
      groupPath,
      parentRecordId: parentRecordId ?? null,
      deletedAt: null,
    },
    orderBy: { sortOrder: "asc" },
  });
  if (existing) return existing.id;

  const created = await addRecord(tx, {
    projectId,
    sectionKey: section.key,
    groupPath,
    parentRecordId: parentRecordId ?? null,
  });
  return created.id;
}

function requireFieldInGroup(section, groupPath, fieldKey) {
  const known = walkFields(section.fieldTree.children, { includeDerived: true }).find(
    (f) => f.key === fieldKey && (f._groupPath ?? "") === groupPath
  );
  if (!known) {
    throw badRequest(`Unknown fieldKey "${fieldKey}" for groupPath "${groupPath}".`);
  }
  if (known.derive) throw badRequest(`"${fieldKey}" is read-only.`);
}

async function requireRecordInSection(tx, { projectId, sectionKey, recordId }) {
  const record = await tx.sectionRecord.findFirst({
    where: { id: recordId, projectId, sectionKey, deletedAt: null },
    select: { id: true },
  });
  if (!record) throw badRequest("recordId is not a record in this section.");
}

/**
 * Apply one action inside a transaction. Returns true when it stored a value
 * or a gap, so a NOT_STARTED section moves to TO_REVIEW.
 */
async function applyAction(tx, { projectId, section, userId }, body) {
  const action = body?.action;
  if (!ACTIONS.has(action)) throw badRequest(`Unknown field action "${action}".`);

  if (action === "choose") {
    if (!body?.candidateId) throw badRequest("candidateId is required for choose.");
    await chooseCandidate(tx, { candidateId: body.candidateId, userId });
    return false;
  }

  const fieldKey = body?.fieldKey;
  let recordId = body?.recordId;
  if (!fieldKey) throw badRequest("fieldKey is required.");

  let wrote = false;
  if (!recordId) {
    if (!WRITE_WITHOUT_RECORD.has(action) || typeof body?.groupPath !== "string") {
      throw badRequest("recordId and fieldKey are required.");
    }
    recordId = await resolveGroupRecord(tx, {
      projectId,
      section,
      groupPath: body.groupPath,
      parentRecordId: body.parentRecordId ?? null,
      fieldKey,
    });
  } else {
    await requireRecordInSection(tx, { projectId, sectionKey: section.key, recordId });
  }

  switch (action) {
    case "accept":
      await acceptField(tx, { recordId, fieldKey, userId });
      break;
    case "edit":
      await editField(tx, {
        projectId,
        sectionKey: section.key,
        recordId,
        fieldKey,
        value: body.value,
        userId,
        reason: body.reason,
      });
      wrote = true;
      break;
    case "gap":
      await gapField(tx, { recordId, fieldKey, userId });
      wrote = true;
      break;
    case "undo":
      await tx.fieldValue.update({
        where: { recordId_fieldKey: { recordId, fieldKey } },
        data: { review: "PENDING", reviewedById: null, reviewedAt: null },
      });
      break;
    default:
      break;
  }
  return wrote;
}

function actionFailure(error, index) {
  const message =
    error?.code === "P2025"
      ? "Field not found. Use recordId and fieldKey from GET section."
      : error?.message || "Field action failed.";
  const code = index == null && typeof error?.code === "number" ? error.code : 400;
  const out = Object.assign(new Error(message), { code });
  if (index != null) out.index = index;
  return out;
}

/**
 * Single action body, or { actions: [...] } applied in one transaction.
 * Any failure rolls back every action.
 */
export async function applyFieldPatch(db, projectId, sectionKey, body, userId) {
  const section = requireSectionKey(sectionKey);
  const batch = Array.isArray(body?.actions);
  const actions = batch ? body.actions : [body];

  if (batch && actions.length === 0) throw badRequest("actions must not be empty.");
  if (actions.length > MAX_BATCH_ACTIONS) {
    throw badRequest(`At most ${MAX_BATCH_ACTIONS} actions per request.`);
  }

  await ensureSectionState(db, projectId, section.key);
  const ctx = { projectId, section, userId };

  await db.$transaction(async (tx) => {
    let wrote = false;
    for (const [index, action] of actions.entries()) {
      try {
        wrote = (await applyAction(tx, ctx, action)) || wrote;
      } catch (error) {
        throw actionFailure(error, batch ? index : null);
      }
    }
    if (wrote) {
      await tx.sectionState.updateMany({
        where: { projectId, sectionKey: section.key, status: "NOT_STARTED" },
        data: { status: "TO_REVIEW" },
      });
    }
  }, TRANSACTION_OPTIONS);

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
