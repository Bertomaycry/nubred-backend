import prismaDefault from "../../lib/prisma.js";
import { ensureStorage } from "../project/storage/provider.js";
import { platformBucketName } from "./platform-bucket.js";

/**
 * Expire PENDING_UPLOAD rows past expiresAt and delete any object that landed.
 * @returns {Promise<number>} rows marked EXPIRED
 */
export async function expireStaleFilterUploads(overrides = {}) {
  const prisma = overrides.prisma ?? prismaDefault;
  const storage = overrides.storage ?? (await ensureStorage());
  const now = overrides.now ?? new Date();

  const stale = await prisma.filterUpload.findMany({
    where: {
      status: "PENDING_UPLOAD",
      expiresAt: { lte: now },
    },
  });

  if (stale.length === 0) return 0;

  const tenantIds = [
    ...new Set(stale.map((row) => row.tenantId).filter(Boolean)),
  ];
  const tenants =
    tenantIds.length > 0
      ? await prisma.tenant.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, bucketName: true },
        })
      : [];
  const bucketByTenant = new Map(tenants.map((t) => [t.id, t.bucketName]));
  const platformBucket = platformBucketName();

  for (const row of stale) {
    const bucket =
      row.kind === "USER"
        ? bucketByTenant.get(row.tenantId)
        : platformBucket;
    if (bucket) {
      try {
        await storage.deleteObject(bucket, row.storageKey);
      } catch (error) {
        console.warn(
          `Filter upload cleanup: could not delete ${row.storageKey}: ${error.message}`
        );
      }
    }
  }

  const updated = await prisma.filterUpload.updateMany({
    where: {
      id: { in: stale.map((row) => row.id) },
      status: "PENDING_UPLOAD",
    },
    data: { status: "EXPIRED" },
  });

  return updated.count;
}
