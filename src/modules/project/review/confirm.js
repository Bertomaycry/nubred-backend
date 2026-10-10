import prisma from "../../../lib/prisma.js";
import { evaluateSectionRules } from "./evaluate-rules.js";
import { requireSectionKey, requireSucceededDraft } from "./load.js";
import { promoteConfirmedSection } from "./promote.js";

/**
 * Validate blocking rules, lock a payload snapshot, and promote into domain tables.
 * Does not activate the project (that is a later step).
 * Chatbot is not involved.
 */
export async function confirmSection({
  projectId,
  sectionKey,
  userId,
  warningsAck,
}) {
  const section = requireSectionKey(sectionKey);
  const row = await requireSucceededDraft(projectId, sectionKey);

  const evaluation = evaluateSectionRules(section.rules, {
    extraction: row.payload,
    fieldMeta: row.fieldMeta,
    reviewState: row.reviewState,
  });

  if (!evaluation.canConfirm) {
    throw Object.assign(
      new Error("Section cannot be confirmed until blocking rules are resolved."),
      {
        code: 409,
        blocking: evaluation.blocking,
        warnings: evaluation.warnings,
      }
    );
  }

  const ack = Array.isArray(warningsAck)
    ? warningsAck.filter((id) => typeof id === "string")
    : [];

  const confirmation = await prisma.$transaction(async (tx) => {
    await promoteConfirmedSection(tx, {
      projectId,
      sectionKey,
      payload: row.payload,
    });

    return tx.sectionConfirmation.upsert({
      where: {
        projectId_sectionKey: { projectId, sectionKey },
      },
      create: {
        projectId,
        sectionKey,
        confirmedById: userId,
        payloadSnapshot: row.payload,
        reviewState: row.reviewState ?? {},
        warningsAck: ack,
      },
      update: {
        confirmedById: userId,
        confirmedAt: new Date(),
        payloadSnapshot: row.payload,
        reviewState: row.reviewState ?? {},
        warningsAck: ack,
      },
    });
  });

  return { confirmation, evaluation, section: row };
}
