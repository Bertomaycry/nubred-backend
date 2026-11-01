import prisma from "../../../lib/prisma.js";
import { JOB_TYPE_VALUES } from "./types.js";

/**
 * Insert a PENDING job into the platform database. Callers (HTTP handlers)
 * never run the work themselves. The job names the tenant whose database and
 * bucket the handler will open, so tenantId is required.
 *
 * Tenant-database writes and this insert cannot share a transaction: write the
 * tenant rows first, then enqueue.
 *
 * @param {Object} params
 * @param {string} params.type
 * @param {string} params.tenantId
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
  if (!tenantId) {
    throw new Error("enqueueJob requires tenantId.");
  }

  return tx.job.create({
    data: {
      type,
      tenantId,
      projectId: projectId ?? null,
      payload,
      maxAttempts,
      availableAt: availableAt ?? new Date(),
      status: "PENDING",
    },
  });
}
