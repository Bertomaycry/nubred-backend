function iso(value) {
  if (!value) return value;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function displayName(user) {
  if (!user) return "NuBred Admin";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.email || "NuBred Admin";
}

export function uploadedByAdmin(user, currentUserId) {
  return {
    kind: "admin",
    displayName: displayName(user),
    isCurrentUser: Boolean(currentUserId && user?.id === currentUserId),
    clientId: null,
    clientName: null,
  };
}

export function uploadedByClient(tenant, { user, currentUserId } = {}) {
  return {
    kind: "client",
    displayName: user ? displayName(user) : (tenant?.name ?? ""),
    isCurrentUser: Boolean(currentUserId && user?.id === currentUserId),
    clientId: tenant?.id ?? null,
    clientName: tenant?.name ?? null,
  };
}

export function serializeFilterListItem(row, uploadedBy) {
  return {
    id: row.id,
    sectionKey: row.sectionKey,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    uploadedBy,
  };
}

export function serializeMasterFilter(row, uploadedBy) {
  return {
    ...serializeFilterListItem(row, uploadedBy),
    content: row.content,
    version: row.version,
    sourceUserFilterId: row.sourceUserFilterId ?? null,
  };
}

export function serializeUserFilter(row, uploadedBy) {
  return {
    ...serializeFilterListItem(row, uploadedBy),
    content: row.content,
    status: row.status,
    promotedMasterFilterId: row.promotedMasterFilterId ?? null,
  };
}

export function serializeTenantSuggestion(row, uploadedBy) {
  return {
    ...serializeFilterListItem(row, uploadedBy),
    status: row.status,
  };
}
