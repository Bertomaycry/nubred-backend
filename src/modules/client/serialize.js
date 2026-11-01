import { enabledModuleIds } from "./modules.js";
import { compareUsers } from "./roles.js";
import { usageForUser } from "./usage.js";

const ownerEmail = (users) =>
  users.find((u) => u.role === "owner")?.email ?? null;

/**
 * Admin list card.
 * @param {object} tenant with users[] and modules[] loaded
 */
export function serializeClientListItem(tenant) {
  return {
    id: tenant.id,
    name: tenant.name,
    email: ownerEmail(tenant.users),
    status: tenant.status,
    usersCount: tenant.users.length,
    modulesCount: enabledModuleIds(tenant.modules).length,
  };
}

/**
 * Admin detail / edit payload.
 * @param {object} tenant with users[] and modules[] loaded
 * @param {{ time: Map, tokens: Map }} usage from loadTenantUsage
 */
export function serializeClientDetail(tenant, usage) {
  const moduleIds = enabledModuleIds(tenant.modules);
  const users = [...tenant.users].sort(compareUsers).map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    ...usageForUser(usage, u.id),
  }));

  return {
    id: tenant.id,
    name: tenant.name,
    email: ownerEmail(tenant.users),
    status: tenant.status,
    usersCount: tenant.users.length,
    modulesCount: moduleIds.length,
    maxProjects: tenant.maxProjects,
    uniqueUrl: tenant.slug,
    createdAt: tenant.createdAt,
    moduleIds,
    users,
  };
}
