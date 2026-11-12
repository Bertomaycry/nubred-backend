import { ClientError } from "./errors.js";
import { bucketNameFor, databaseNameFor } from "./slug.js";

export const SLUG_TAKEN = "This unique URL is already in use.";

/**
 * Reject a slug that create would reject. A failed earlier attempt is free
 * to retry, unless its database or bucket is still there.
 *
 * @returns {Promise<object | null>} the failed tenant row, when one exists
 */
export async function assertSlugAvailable(slug, { prisma, databaseExists, storage }) {
  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing && existing.provisioningStatus !== "failed") {
    throw new ClientError(409, SLUG_TAKEN);
  }

  const store = await storage();
  if (
    (await databaseExists(databaseNameFor(slug))) ||
    (await store.bucketExists(bucketNameFor(slug)))
  ) {
    throw new ClientError(409, SLUG_TAKEN);
  }

  return existing ?? null;
}
