import prisma from "../lib/prisma.js";

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "preview",
  "governance",
  "node",
  "localhost",
]);

/**
 * Resolve tenant slug from X-Tenant-Slug, then Host subdomain, then default.
 * @param {import('express').Request} req
 * @returns {string}
 */
export function resolveTenantSlug(req) {
  const header = req.headers["x-tenant-slug"];
  if (typeof header === "string" && header.trim()) {
    return header.trim().toLowerCase();
  }

  const host = String(req.headers.host || "").split(":")[0];
  const parts = host.split(".");
  if (parts.length >= 3) {
    const sub = parts[0].toLowerCase();
    if (!RESERVED_SUBDOMAINS.has(sub)) return sub;
  }

  return (process.env.NUBRED_DEFAULT_TENANT_SLUG || "dev").toLowerCase();
}

/**
 * Load (or create, in development) the tenant for this request.
 * Must run after attachUser (uses req.user).
 */
export const attachTenant = async (req, res, next) => {
  try {
    const slug = resolveTenantSlug(req);
    let tenant = await prisma.tenant.findUnique({ where: { slug } });

    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          slug,
          name: slug === "dev" ? "Development tenant" : slug,
        },
      });
    }

    const membership = await prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: req.user.id } },
    });

    req.tenant = tenant;
    req.tenantMembership = membership;
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
 * Ensure the user belongs to this tenant. Project creators are auto-joined
 * on first project create; other routes require an existing membership.
 */
export const requireTenantMember = (req, res, next) => {
  if (req.tenantMembership) return next();
  return res.status(403).json({
    success: false,
    message: "You are not a member of this organisation.",
  });
};
