import prisma from "./prisma.js";
import { getTenantDb } from "./tenant-prisma.js";

/**
 * Resolve the tenant database + bucket for a tenant id (job handlers).
 * HTTP requests get the same values from attachTenant.
 *
 * @param {string} tenantId
 * @returns {Promise<{ tenant: object, db: object, bucket: string }>}
 */
export async function loadTenantContext(tenantId) {
  if (!tenantId) {
    throw new Error("Job is missing tenantId.");
  }
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw new Error(`Tenant ${tenantId} not found.`);
  }
  if (tenant.provisioningStatus !== "ready") {
    throw new Error(`Tenant ${tenant.slug} is not provisioned.`);
  }
  return { tenant, db: getTenantDb(tenant), bucket: tenant.bucketName };
}
