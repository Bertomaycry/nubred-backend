import { ensureStorage } from "../project/storage/provider.js";

export const DEFAULT_PLATFORM_BUCKET = "nubred-platform";

export function platformBucketName() {
  const name = (process.env.NUBRED_PLATFORM_BUCKET || DEFAULT_PLATFORM_BUCKET).trim();
  return name || DEFAULT_PLATFORM_BUCKET;
}

/**
 * Create the private platform bucket if it is missing. Safe to call at startup.
 * @returns {Promise<string>} bucket name
 */
export async function ensurePlatformBucket() {
  const storage = await ensureStorage();
  const bucket = platformBucketName();
  await storage.ensureBucket(bucket);
  return bucket;
}
