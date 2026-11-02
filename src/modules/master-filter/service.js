import { randomUUID } from "node:crypto";
import prismaDefault from "../../lib/prisma.js";
import { ClientError } from "../client/provision.js";
import { ensureStorage } from "../project/storage/provider.js";
import { MASTER_FILTER_SECTIONS, sectionOrThrow } from "./sections.js";
import {
  parseInitUpload,
  masterFilterKey,
  promotedMasterFilterKey,
  userFilterKey,
  MAX_CONTENT_CHARS,
} from "./upload-policy.js";
import { extractFilterText } from "./extract.js";
import { platformBucketName } from "./platform-bucket.js";
import { canWithdrawSuggestion } from "./access.js";
import {
  uploadedByAdmin,
  uploadedByClient,
  serializeFilterListItem,
  serializeMasterFilter,
  serializeUserFilter,
  serializeTenantSuggestion,
} from "./serialize.js";

const PRESIGN_EXPIRES = Number.parseInt(
  process.env.NUBRED_PRESIGN_EXPIRES_SECONDS ?? "900",
  10
);
const PRESIGN_SECONDS = Number.isFinite(PRESIGN_EXPIRES) ? PRESIGN_EXPIRES : 900;

const USER_SELECT = { id: true, firstName: true, lastName: true, email: true };

function defaultDeps() {
  return {
    prisma: prismaDefault,
    storage: ensureStorage,
    extractText: extractFilterText,
    now: () => new Date(),
  };
}

function depsOf(overrides) {
  return { ...defaultDeps(), ...overrides };
}

function notFound(what) {
  return new ClientError(
    404,
    what === "master" ? "Master filter not found." : what === "upload" ? "Upload not found." : "Suggestion not found."
  );
}

async function loadUsers(prisma, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: USER_SELECT,
  });
  return new Map(rows.map((u) => [u.id, u]));
}

function presignPayload(presigned) {
  return {
    url: presigned.url,
    method: presigned.method ?? "PUT",
    headers: presigned.headers ?? {},
  };
}

async function failUpload({ prisma, storage, upload, bucket, reason }) {
  await prisma.filterUpload.update({
    where: { id: upload.id },
    data: { status: "FAILED", failureReason: reason },
  });
  try {
    await storage.deleteObject(bucket, upload.storageKey);
  } catch (error) {
    console.warn(
      `Could not delete failed filter upload ${upload.storageKey}: ${error.message}`
    );
  }
}

async function verifyAndExtract({ storage, upload, bucket, extractText }) {
  const head = await storage.headObject(bucket, upload.storageKey);
  if (!head.exists) {
    throw new ClientError(
      400,
      "The file did not finish uploading. Please try again."
    );
  }
  if (head.sizeBytes != null && head.sizeBytes !== upload.declaredSize) {
    throw new ClientError(
      400,
      "The uploaded file does not match its declared size."
    );
  }

  let buffer;
  try {
    buffer = await storage.getObjectBuffer(bucket, upload.storageKey);
  } catch {
    throw new ClientError(
      400,
      "The file did not finish uploading. Please try again."
    );
  }

  return extractText(buffer, upload.mimeType);
}

function assertPendingUpload(upload, now) {
  if (upload.status === "COMPLETED") {
    throw new ClientError(409, "This upload was already completed.");
  }
  if (upload.status === "EXPIRED" || upload.expiresAt.getTime() <= now.getTime()) {
    throw new ClientError(
      410,
      "This upload expired. Please upload the file again."
    );
  }
  if (upload.status !== "PENDING_UPLOAD") {
    throw new ClientError(
      400,
      "The file did not finish uploading. Please try again."
    );
  }
}

async function countBySection(prisma) {
  const [master, pending] = await Promise.all([
    prisma.masterFilter.groupBy({
      by: ["sectionKey"],
      _count: { _all: true },
    }),
    prisma.userFilter.groupBy({
      by: ["sectionKey"],
      where: { status: "PENDING" },
      _count: { _all: true },
    }),
  ]);
  const masterMap = new Map(master.map((r) => [r.sectionKey, r._count._all]));
  const pendingMap = new Map(pending.map((r) => [r.sectionKey, r._count._all]));
  return MASTER_FILTER_SECTIONS.map((s) => ({
    key: s.key,
    title: s.title,
    masterFilterCount: masterMap.get(s.key) ?? 0,
    suggestionCount: pendingMap.get(s.key) ?? 0,
  }));
}

export async function listSectionSummaries(overrides = {}) {
  const { prisma } = depsOf(overrides);
  return countBySection(prisma);
}

export async function getSectionDetail(sectionKey, currentUserId, overrides = {}) {
  const { prisma } = depsOf(overrides);
  const section = sectionOrThrow(sectionKey);

  const [summaries, masterRows, userRows] = await Promise.all([
    countBySection(prisma),
    prisma.masterFilter.findMany({
      where: { sectionKey: section.key },
      orderBy: { createdAt: "asc" },
    }),
    prisma.userFilter.findMany({
      where: { sectionKey: section.key, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: { tenant: { select: { id: true, name: true } } },
    }),
  ]);

  const users = await loadUsers(prisma, [
    ...masterRows.map((r) => r.createdById),
    ...userRows.map((r) => r.submittedByUserId),
  ]);

  return {
    section: summaries.find((s) => s.key === section.key),
    masterFilters: masterRows.map((row) =>
      serializeFilterListItem(
        row,
        uploadedByAdmin(users.get(row.createdById), currentUserId)
      )
    ),
    userFilters: userRows.map((row) =>
      serializeFilterListItem(
        row,
        uploadedByClient(row.tenant, {
          user: users.get(row.submittedByUserId),
          currentUserId,
        })
      )
    ),
  };
}

export async function getMasterFilterById(filterId, currentUserId, overrides = {}) {
  const { prisma } = depsOf(overrides);
  const row = await prisma.masterFilter.findUnique({ where: { id: filterId } });
  if (!row) throw notFound("master");
  const users = await loadUsers(prisma, [row.createdById]);
  return serializeMasterFilter(
    row,
    uploadedByAdmin(users.get(row.createdById), currentUserId)
  );
}

export async function getUserFilterById(userFilterId, currentUserId, overrides = {}) {
  const { prisma } = depsOf(overrides);
  const row = await prisma.userFilter.findUnique({
    where: { id: userFilterId },
    include: { tenant: { select: { id: true, name: true } } },
  });
  if (!row) throw notFound("suggestion");
  const users = await loadUsers(prisma, [row.submittedByUserId]);
  return serializeUserFilter(
    row,
    uploadedByClient(row.tenant, {
      user: users.get(row.submittedByUserId),
      currentUserId,
    })
  );
}

async function initUpload({
  kind,
  sectionKey,
  body,
  userId,
  tenantId,
  bucket,
  keyFor,
  overrides,
}) {
  const { prisma, storage: storageFn, now } = depsOf(overrides);
  const section = sectionOrThrow(sectionKey);
  const parsed = parseInitUpload(body);
  if (!parsed.ok) throw new ClientError(400, parsed.message);

  const storage = await storageFn();
  const uploadId = randomUUID();
  const storageKey = keyFor({
    sectionKey: section.key,
    uploadId,
    fileName: parsed.data.fileName,
  });
  const expiresAt = new Date(now().getTime() + PRESIGN_SECONDS * 1000);

  await prisma.filterUpload.create({
    data: {
      id: uploadId,
      kind,
      sectionKey: section.key,
      tenantId: tenantId ?? null,
      createdById: userId,
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      declaredSize: parsed.data.size,
      storageKey,
      status: "PENDING_UPLOAD",
      expiresAt,
    },
  });

  const presigned = await storage.getPresignedPutUrl({
    bucket,
    key: storageKey,
    mimeType: parsed.data.mimeType,
    expiresIn: PRESIGN_SECONDS,
  });

  return {
    uploadId,
    upload: presignPayload(presigned),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function initMasterUpload({ sectionKey, body, userId }, overrides = {}) {
  return initUpload({
    kind: "MASTER",
    sectionKey,
    body,
    userId,
    tenantId: null,
    bucket: platformBucketName(),
    keyFor: masterFilterKey,
    overrides,
  });
}

export async function initUserUpload(
  { sectionKey, body, userId, tenant },
  overrides = {}
) {
  return initUpload({
    kind: "USER",
    sectionKey,
    body,
    userId,
    tenantId: tenant.id,
    bucket: tenant.bucketName,
    keyFor: userFilterKey,
    overrides,
  });
}

export async function completeMasterUpload({ uploadId, userId }, overrides = {}) {
  const { prisma, storage: storageFn, extractText, now } = depsOf(overrides);
  const storage = await storageFn();
  const bucket = platformBucketName();

  const upload = await prisma.filterUpload.findUnique({
    where: { id: uploadId },
  });
  if (!upload || upload.kind !== "MASTER") throw notFound("upload");
  assertPendingUpload(upload, now());

  let content;
  try {
    content = await verifyAndExtract({ storage, upload, bucket, extractText });
  } catch (error) {
    await failUpload({
      prisma,
      storage,
      upload,
      bucket,
      reason: error.message,
    });
    throw error;
  }

  try {
    const filter = await prisma.$transaction(async (tx) => {
      const created = await tx.masterFilter.create({
        data: {
          sectionKey: upload.sectionKey,
          fileName: upload.fileName,
          mimeType: upload.mimeType,
          sizeBytes: upload.declaredSize,
          storageKey: upload.storageKey,
          content,
          version: 1,
          createdById: userId,
        },
      });
      await tx.filterUpload.update({
        where: { id: upload.id },
        data: { status: "COMPLETED" },
      });
      return created;
    });

    const users = await loadUsers(prisma, [filter.createdById]);
    return serializeMasterFilter(
      filter,
      uploadedByAdmin(users.get(filter.createdById), userId)
    );
  } catch (error) {
    await failUpload({
      prisma,
      storage,
      upload,
      bucket,
      reason: error.message,
    });
    throw error;
  }
}

export async function completeUserUpload(
  { uploadId, userId, tenant },
  overrides = {}
) {
  const { prisma, storage: storageFn, extractText, now } = depsOf(overrides);
  const storage = await storageFn();
  const bucket = tenant.bucketName;

  const upload = await prisma.filterUpload.findUnique({
    where: { id: uploadId },
  });
  if (!upload || upload.kind !== "USER" || upload.tenantId !== tenant.id) {
    throw notFound("upload");
  }
  assertPendingUpload(upload, now());

  let content;
  try {
    content = await verifyAndExtract({ storage, upload, bucket, extractText });
  } catch (error) {
    await failUpload({
      prisma,
      storage,
      upload,
      bucket,
      reason: error.message,
    });
    throw error;
  }

  try {
    const filter = await prisma.$transaction(async (tx) => {
      const created = await tx.userFilter.create({
        data: {
          sectionKey: upload.sectionKey,
          tenantId: tenant.id,
          submittedByUserId: upload.createdById,
          fileName: upload.fileName,
          mimeType: upload.mimeType,
          sizeBytes: upload.declaredSize,
          storageKey: upload.storageKey,
          content,
          status: "PENDING",
        },
        include: { tenant: { select: { id: true, name: true } } },
      });
      await tx.filterUpload.update({
        where: { id: upload.id },
        data: { status: "COMPLETED" },
      });
      return created;
    });

    const users = await loadUsers(prisma, [filter.submittedByUserId]);
    return serializeUserFilter(
      filter,
      uploadedByClient(filter.tenant, {
        user: users.get(filter.submittedByUserId),
        currentUserId: userId,
      })
    );
  } catch (error) {
    await failUpload({
      prisma,
      storage,
      upload,
      bucket,
      reason: error.message,
    });
    throw error;
  }
}

function parsePatchBody(body) {
  if (typeof body?.content !== "string") {
    throw new ClientError(400, "Content is required.");
  }
  if (!body.content.trim()) {
    throw new ClientError(400, "Content cannot be empty.");
  }
  if (body.content.length > MAX_CONTENT_CHARS) {
    throw new ClientError(
      400,
      "Content is too long. The limit is 1,000,000 characters."
    );
  }
  if (!Number.isInteger(body?.version)) {
    throw new ClientError(400, "Version is required.");
  }
  return { content: body.content, version: body.version };
}

export async function updateMasterFilter(
  { filterId, body, userId },
  overrides = {}
) {
  const { prisma } = depsOf(overrides);
  const { content, version } = parsePatchBody(body);

  const changed = await prisma.masterFilter.updateMany({
    where: { id: filterId, version },
    data: {
      content,
      version: { increment: 1 },
      updatedById: userId,
    },
  });

  if (changed.count === 0) {
    const exists = await prisma.masterFilter.findUnique({
      where: { id: filterId },
      select: { id: true },
    });
    if (!exists) throw notFound("master");
    throw new ClientError(
      409,
      "This master filter was changed by someone else. Reload it and try again."
    );
  }

  return getMasterFilterById(filterId, userId, overrides);
}

export async function deleteMasterFilter(filterId, overrides = {}) {
  const { prisma, storage: storageFn } = depsOf(overrides);
  const row = await prisma.masterFilter.findUnique({ where: { id: filterId } });
  if (!row) throw notFound("master");

  await prisma.masterFilter.delete({ where: { id: filterId } });

  try {
    const storage = await storageFn();
    await storage.deleteObject(platformBucketName(), row.storageKey);
  } catch (error) {
    console.warn(
      `Could not delete master filter object ${row.storageKey}: ${error.message}`
    );
  }
}

export async function promoteUserFilter(
  { userFilterId, userId },
  overrides = {}
) {
  const { prisma, storage: storageFn } = depsOf(overrides);
  const storage = await storageFn();

  const userFilter = await prisma.userFilter.findUnique({
    where: { id: userFilterId },
    include: { tenant: { select: { id: true, name: true, bucketName: true } } },
  });
  if (!userFilter) throw notFound("suggestion");
  if (userFilter.status !== "PENDING") {
    throw new ClientError(
      409,
      "This suggestion was already added to the master filter."
    );
  }

  const destKey = promotedMasterFilterKey({
    sectionKey: userFilter.sectionKey,
    userFilterId: userFilter.id,
    fileName: userFilter.fileName,
  });
  const destBucket = platformBucketName();

  try {
    await storage.copyObject({
      sourceBucket: userFilter.tenant.bucketName,
      sourceKey: userFilter.storageKey,
      destBucket,
      destKey,
      mimeType: userFilter.mimeType,
    });
  } catch (error) {
    console.error(`Promote copy failed for ${userFilterId}:`, error);
    throw new ClientError(500, "Could not copy the suggestion file. Try again.");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.userFilter.findUnique({
        where: { id: userFilterId },
      });
      if (!current) throw notFound("suggestion");
      if (current.status !== "PENDING") {
        throw new ClientError(
          409,
          "This suggestion was already added to the master filter."
        );
      }

      const master = await tx.masterFilter.create({
        data: {
          sectionKey: userFilter.sectionKey,
          fileName: userFilter.fileName,
          mimeType: userFilter.mimeType,
          sizeBytes: userFilter.sizeBytes,
          storageKey: destKey,
          content: userFilter.content,
          version: 1,
          sourceUserFilterId: userFilter.id,
          createdById: userId,
        },
      });

      const accepted = await tx.userFilter.update({
        where: { id: userFilter.id },
        data: {
          status: "ACCEPTED",
          promotedMasterFilterId: master.id,
          reviewedById: userId,
          reviewedAt: new Date(),
        },
        include: { tenant: { select: { id: true, name: true } } },
      });

      return { master, accepted };
    });

    const users = await loadUsers(prisma, [
      result.master.createdById,
      result.accepted.submittedByUserId,
    ]);

    return {
      masterFilter: serializeMasterFilter(
        result.master,
        uploadedByAdmin(users.get(result.master.createdById), userId)
      ),
      userFilter: serializeUserFilter(
        result.accepted,
        uploadedByClient(result.accepted.tenant, {
          user: users.get(result.accepted.submittedByUserId),
          currentUserId: userId,
        })
      ),
    };
  } catch (error) {
    try {
      await storage.deleteObject(destBucket, destKey);
    } catch (cleanupError) {
      console.warn(
        `Promote rollback delete failed for ${destKey}: ${cleanupError.message}`
      );
    }
    if (error.code === "P2002") {
      throw new ClientError(
        409,
        "This suggestion was already added to the master filter."
      );
    }
    throw error;
  }
}

export async function dismissUserFilter({ userFilterId, userId }, overrides = {}) {
  const { prisma } = depsOf(overrides);
  const row = await prisma.userFilter.findUnique({
    where: { id: userFilterId },
  });
  if (!row) throw notFound("suggestion");
  if (row.status !== "PENDING") {
    throw new ClientError(409, "This suggestion was already reviewed.");
  }

  const updated = await prisma.userFilter.updateMany({
    where: { id: userFilterId, status: "PENDING" },
    data: {
      status: "DISMISSED",
      reviewedById: userId,
      reviewedAt: new Date(),
    },
  });
  if (updated.count === 0) {
    throw new ClientError(409, "This suggestion was already reviewed.");
  }

  return getUserFilterById(userFilterId, userId, overrides);
}

export async function listTenantSuggestions(
  { tenant, sectionKey, currentUserId },
  overrides = {}
) {
  const { prisma } = depsOf(overrides);
  if (sectionKey) sectionOrThrow(sectionKey);

  const rows = await prisma.userFilter.findMany({
    where: {
      tenantId: tenant.id,
      ...(sectionKey ? { sectionKey } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { tenant: { select: { id: true, name: true } } },
  });
  const users = await loadUsers(
    prisma,
    rows.map((r) => r.submittedByUserId)
  );

  return rows.map((row) =>
    serializeTenantSuggestion(
      row,
      uploadedByClient(row.tenant, {
        user: users.get(row.submittedByUserId),
        currentUserId,
      })
    )
  );
}

export async function withdrawSuggestion(
  { userFilterId, tenant, userId, tenantRole },
  overrides = {}
) {
  const { prisma, storage: storageFn } = depsOf(overrides);
  const row = await prisma.userFilter.findFirst({
    where: { id: userFilterId, tenantId: tenant.id },
  });
  if (
    !row ||
    !canWithdrawSuggestion({
      tenantRole,
      submittedByUserId: row.submittedByUserId,
      userId,
    })
  ) {
    throw notFound("suggestion");
  }
  if (row.status !== "PENDING") {
    throw new ClientError(409, "This suggestion was already reviewed.");
  }

  await prisma.userFilter.delete({ where: { id: row.id } });

  try {
    const storage = await storageFn();
    await storage.deleteObject(tenant.bucketName, row.storageKey);
  } catch (error) {
    console.warn(
      `Could not delete user filter object ${row.storageKey}: ${error.message}`
    );
  }
}
