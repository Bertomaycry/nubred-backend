import prisma from "../../../lib/prisma.js";
import { AI_MODULE_IDS } from "../../client/modules.js";
import { creditsFor } from "../../client/usage.js";

/**
 * Write one ai_usage_events row for a SUCCESSFUL call to an AI module.
 * Call it only after the provider returned a billable response, with the
 * tenant user taken from the login (req.tenantUser), never from a body.
 *
 * `requestId` is unique per provider call; a retry of the same call is a no-op.
 * Governance modules (not in AI_MODULE_IDS) never write credits.
 *
 * Nothing calls this yet; the AI modules wire it in when they ship.
 *
 * @param {{
 *   tenantId: string,
 *   tenantUserId: string,
 *   moduleId: string,
 *   promptTokens?: number | null,
 *   completionTokens?: number | null,
 *   requestId: string,
 * }} params
 * @returns {Promise<{ recorded: boolean, credits: number }>}
 */
export async function recordAiUsage({
  tenantId,
  tenantUserId,
  moduleId,
  promptTokens,
  completionTokens,
  requestId,
}) {
  if (!AI_MODULE_IDS.includes(moduleId)) {
    throw new Error(`"${moduleId}" is not an AI module; it never writes credits.`);
  }
  if (!requestId) throw new Error("requestId is required.");

  const credits = creditsFor({ promptTokens, completionTokens });

  const result = await prisma.aiUsageEvent.createMany({
    data: [
      {
        tenantId,
        tenantUserId,
        moduleId,
        credits,
        promptTokens: promptTokens ?? null,
        completionTokens: completionTokens ?? null,
        requestId,
      },
    ],
    skipDuplicates: true,
  });

  return { recorded: result.count === 1, credits };
}
