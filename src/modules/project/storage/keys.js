/**
 * S3 object key helpers.
 *
 * Layout (one bucket per environment, prefix per tenant):
 *   tenants/{tenantId}/projects/{projectId}/documents/{documentId}/{filename}
 *
 * The same layout works for MinIO, Hetzner Object Storage, and AWS S3.
 */

/**
 * Strip path components and replace characters that are awkward in object keys.
 * @param {string} name
 * @returns {string}
 */
export function sanitizeFilename(name) {
  const base = String(name ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .pop();
  const cleaned = (base || "file")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+/, "");
  return (cleaned || "file").slice(0, 180);
}

/**
 * @param {{ tenantId: string, projectId: string, documentId: string, filename: string }} params
 * @returns {string}
 */
export function buildDocumentKey({ tenantId, projectId, documentId, filename }) {
  return [
    "tenants",
    tenantId,
    "projects",
    projectId,
    "documents",
    documentId,
    sanitizeFilename(filename),
  ].join("/");
}

/**
 * Reject keys that do not belong to the given tenant/project (path traversal / mix-up).
 * @param {string} storageKey
 * @param {{ tenantId: string, projectId: string }} scope
 * @returns {boolean}
 */
export function keyBelongsToProject(storageKey, { tenantId, projectId }) {
  const prefix = `tenants/${tenantId}/projects/${projectId}/documents/`;
  return typeof storageKey === "string" && storageKey.startsWith(prefix);
}
