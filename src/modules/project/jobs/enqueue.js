import prisma from "../../../lib/prisma.js";
import { JOB_TYPE_VALUES } from "./types.js";

/**
 * Insert a PENDING job. Callers (HTTP handlers) never run the work themselves.
 *
 * @param {Object} params
 * @param {string} params.type
 * @param {string} [params.tenantId]
 * @param {string} [params.projectId]
 * @param {object} params.payload
 * @param {number} [params.maxAttempts=3]
 * @param {Date} [params.availableAt]
 */
export async function enqueueJob(
  { type, tenantId, projectId, payload, maxAttempts = 3, availableAt },
  tx = prisma
) {
  if (!JOB_TYPE_VALUES.includes(type)) {
    throw new Error(`Unknown job type "${type}".`);
  }

  return tx.job.create({
    data: {
      type,
      tenantId: tenantId ?? null,
      projectId: projectId ?? null,
      payload,
      maxAttempts,
      availableAt: availableAt ?? new Date(),
      status: "PENDING",
    },
  });
}
