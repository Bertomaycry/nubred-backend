/**
 * Client (tenant) user roles — what the admin Add/Edit Client form assigns.
 * Not the same as project roles (Doc A), which are per project.
 */

/** In detail-card grouping order. */
export const CLIENT_ROLES = [
  "owner",
  "master_project_manager",
  "project_manager",
  "field_observer",
  "viewer",
];

/** Roles the form lets you add as extra (non-owner) users. */
export const ASSIGNABLE_ROLES = CLIENT_ROLES.filter((r) => r !== "owner");

/** Client roles that may create projects (they become Variety Manager of them). */
export const PROJECT_CREATOR_ROLES = [
  "owner",
  "master_project_manager",
  "project_manager",
];

export function roleOrder(role) {
  const index = CLIENT_ROLES.indexOf(role);
  return index === -1 ? CLIENT_ROLES.length : index;
}

/** Owner first, then role order, then email. */
export function compareUsers(a, b) {
  return (
    roleOrder(a.role) - roleOrder(b.role) || a.email.localeCompare(b.email)
  );
}
