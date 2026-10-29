/** Subdomain / database / bucket naming for a client. */

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export const SLUG_MAX_LENGTH = 48;

/** Hosts we run ourselves; a client may not take them as a subdomain. */
export const RESERVED_SLUGS = [
  "www",
  "api",
  "admin",
  "app",
  "mail",
  "minio",
  "dev",
  "staging",
  "static",
  "assets",
];

/**
 * @param {string} slug already lowercased
 * @returns {string | null} an error message, or null when valid
 */
export function slugError(slug) {
  if (!slug) return "Unique URL is required.";
  if (slug.length > SLUG_MAX_LENGTH) {
    return `Unique URL must be at most ${SLUG_MAX_LENGTH} characters.`;
  }
  if (!SLUG_PATTERN.test(slug)) {
    return "Unique URL may only use lowercase letters, numbers and hyphens, and cannot start or end with a hyphen.";
  }
  if (RESERVED_SLUGS.includes(slug)) {
    return "This unique URL is reserved.";
  }
  return null;
}

/** Slugs have no underscore, so this mapping cannot collide. */
export const databaseNameFor = (slug) =>
  `nubred_${slug.replace(/-/g, "_")}`;

export const bucketNameFor = (slug) => `nubred-${slug}`;

export const tenantHostSuffix = () =>
  process.env.NUBRED_TENANT_HOST_SUFFIX || "gov.nubred.com";

export const workspaceUrl = (slug) => `https://${slug}.${tenantHostSuffix()}`;
