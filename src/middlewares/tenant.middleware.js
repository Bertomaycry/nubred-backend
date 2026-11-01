import prisma from "../lib/prisma.js";
import { getTenantDb } from "../lib/tenant-prisma.js";
import { moduleForSection } from "../modules/project/access/section-modules.js";

/**
 * Pick the workspace slug the tenant app says it is working in.
 * This is a SELECTOR only: it never authorises anything. Access always
 * requires a tenant_users row linking this login to that tenant.
 *
 * @param {import('express').Request} req
 * @returns {string | null}
 */
export function requestedTenantSlug(req) {
  const header = req.headers["x-tenant-slug"];
  if (typeof header === "string" && header.trim()) {
    return header.trim().toLowerCase();
  }
  return null;
}

/**
 * Resolve the client workspace for this request. Must run after attachUser.
 *
 * - Links invited tenant_users rows (same email, no Clerk id yet) to this login.
 * - Picks the tenant from X-Tenant-Slug, or the user's only membership.
 * - Requires membership, an active status and a finished provisioning on
 *   EVERY request (nothing is cached for the life of the token).
 *
 * Sets req.tenant, req.tenantUser, req.db (tenant database) and req.bucket.
 */
export const attachTenant = async (req, res, next) => {
  try {
    const email = String(req.user.email ?? "").toLowerCase();

    let memberships = await prisma.tenantUser.findMany({
      where: {
        OR: [
          { clerkUserId: req.user.clerkUserId },
          { email, clerkUserId: null },
        ],
      },
      include: { tenant: true },
    });

    const unlinked = memberships.filter((m) => m.clerkUserId === null);
    if (unlinked.length > 0) {
      await prisma.tenantUser.updateMany({
        where: { id: { in: unlinked.map((m) => m.id) }, clerkUserId: null },
        data: { clerkUserId: req.user.clerkUserId },
      });
      memberships = memberships.map((m) => ({
        ...m,
        clerkUserId: m.clerkUserId ?? req.user.clerkUserId,
      }));
    }

    const slug = requestedTenantSlug(req);
    let membership = null;

    if (slug) {
      membership = memberships.find((m) => m.tenant.slug === slug) ?? null;
    } else if (memberships.length === 1) {
      membership = memberships[0];
    } else if (memberships.length > 1) {
      return res.status(400).json({
        success: false,
        message: "Select a workspace.",
      });
    }

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this workspace.",
      });
    }

    const { tenant, ...tenantUser } = membership;

    if (tenant.provisioningStatus !== "ready") {
      return res.status(403).json({
        success: false,
        message: "This workspace is not available.",
      });
    }
    if (tenant.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "This workspace has been restricted.",
      });
    }

    req.tenant = tenant;
    req.tenantUser = tenantUser;
    req.db = getTenantDb(tenant);
    req.bucket = tenant.bucketName;
    next();
  } catch (error) {
    console.error("Tenant middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to resolve tenant",
    });
  }
};

/**
 * Block the request unless this client has the module switched on.
 * Read fresh on every request so a switch-off takes effect immediately.
 * Hiding a menu in the UI is not enforcement; this is.
 *
 * @param {string} moduleId one of the 13 ids in src/modules/client/modules.js
 */
export const requireModule = (moduleId) => async (req, res, next) => {
  try {
    const row = await prisma.tenantModule.findUnique({
      where: {
        tenantId_moduleId: { tenantId: req.tenant.id, moduleId },
      },
    });
    if (row?.enabled) return next();
    return res.status(403).json({
      success: false,
      message: "This module is not enabled for your organisation.",
    });
  } catch (error) {
    console.error("Module middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check module access",
    });
  }
};

/**
 * Load the set of enabled module ids for this client.
 * @param {string} tenantId
 * @returns {Promise<Set<string>>}
 */
export async function loadEnabledModules(tenantId) {
  const rows = await prisma.tenantModule.findMany({
    where: { tenantId, enabled: true },
    select: { moduleId: true },
  });
  return new Set(rows.map((row) => row.moduleId));
}

/**
 * Gate a section route by the module behind :sectionKey.
 * Unknown section keys fall through so the handler can return its own 400.
 */
export const requireSectionModule = (req, res, next) => {
  const moduleId = moduleForSection(req.params.sectionKey);
  if (!moduleId) return next();
  return requireModule(moduleId)(req, res, next);
};
