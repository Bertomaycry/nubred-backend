export const FILTER_SUBMITTER_ROLES = [
  "owner",
  "master_project_manager",
  "project_manager",
];

export const canSubmitFilters = (role) => FILTER_SUBMITTER_ROLES.includes(role);

/** Submitter of the row, or the client owner. */
export function canWithdrawSuggestion({ tenantRole, submittedByUserId, userId }) {
  return submittedByUserId === userId || tenantRole === "owner";
}
