import { randomUUID } from "node:crypto";
import { extractFilterText } from "../../master-filter/extract.js";
import { parseInitUpload } from "../../master-filter/upload-policy.js";
import { ensureStorage } from "../storage/provider.js";
import {
  buildProjectSectionFilterKey,
  keyBelongsToProjectFilter,
} from "../storage/keys.js";
import { getSection, isSectionKey } from "../sections/registry.js";

const MAX_FILTER_BYTES = 10 * 1024 * 1024;
const PRESIGN_SECONDS = Number.parseInt(
  process.env.NUBRED_PRESIGN_EXPIRES_SECONDS ?? "900",
  10
);

function parseProjectFilterUpload(body) {
  const parsed = parseInitUpload(body);
  if (!parsed.ok) return parsed;
  if (parsed.data.size > MAX_FILTER_BYTES) {
    return { ok: false, message: "File is larger than 10 MB." };
  }
  return parsed;
}

export async function getLatestUserFilter(db, projectId, sectionKey) {
  return db.projectSectionFilter.findFirst({
    where: { projectId, sectionKey },
    orderBy: { version: "desc" },
  });
}

export async function getUserFilterContent(db, projectId, sectionKey) {
  const row = await getLatestUserFilter(db, projectId, sectionKey);
  if (!row) return { version: null, text: "" };
  return {
    version: row.version,
    text: [row.content, row.fileName ? `(see attached ${row.fileName})` : ""]
      .filter(Boolean)
      .join("\n"),
  };
}

export async function saveUserFilterText({
  db,
  projectId,
  sectionKey,
  content,
  createdById,
}) {
  if (!isSectionKey(sectionKey)) {
    throw Object.assign(new Error(`Unknown section "${sectionKey}".`), { code: 400 });
  }
  const latest = await getLatestUserFilter(db, projectId, sectionKey);
  const version = (latest?.version ?? 0) + 1;
  return db.projectSectionFilter.create({
    data: {
      projectId,
      sectionKey,
      version,
      content: content ?? "",
      createdById,
    },
  });
}

export async function initFilterUpload({
  db,
  bucket,
  projectId,
  sectionKey,
  body,
  createdById,
}) {
  const parsed = parseProjectFilterUpload(body);
  if (!parsed.ok) {
    throw Object.assign(new Error(parsed.message), { code: 400 });
  }
  if (!isSectionKey(sectionKey)) {
    throw Object.assign(new Error(`Unknown section "${sectionKey}".`), { code: 400 });
  }

  const filterId = randomUUID();
  const storageKey = buildProjectSectionFilterKey({
    projectId,
    sectionKey,
    filterId,
    filename: parsed.data.fileName,
  });

  const latest = await getLatestUserFilter(db, projectId, sectionKey);
  const version = (latest?.version ?? 0) + 1;

  const row = await db.projectSectionFilter.create({
    data: {
      id: filterId,
      projectId,
      sectionKey,
      version,
      storageKey,
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      createdById,
    },
  });

  const storage = await ensureStorage();
  const presigned = await storage.presignPut(bucket, storageKey, {
    expiresIn: Number.isFinite(PRESIGN_SECONDS) ? PRESIGN_SECONDS : 900,
    contentType: parsed.data.mimeType,
  });

  return {
    filter: row,
    upload: {
      url: presigned.url,
      method: presigned.method ?? "PUT",
      headers: presigned.headers ?? {},
    },
  };
}

export async function completeFilterUpload({
  db,
  bucket,
  projectId,
  sectionKey,
  filterId,
}) {
  const row = await db.projectSectionFilter.findFirst({
    where: { id: filterId, projectId, sectionKey },
  });
  if (!row?.storageKey) {
    throw Object.assign(new Error("Filter upload not found."), { code: 404 });
  }
  if (!keyBelongsToProjectFilter(row.storageKey, { projectId, sectionKey })) {
    throw Object.assign(new Error("Invalid filter storage key."), { code: 500 });
  }

  const storage = await ensureStorage();
  const head = await storage.headObject(bucket, row.storageKey);
  if (!head.exists) {
    throw Object.assign(new Error("File not found in storage."), { code: 400 });
  }

  const buffer = await storage.getObjectBuffer(bucket, row.storageKey);
  const text = await extractFilterText(buffer, row.mimeType);

  return db.projectSectionFilter.update({
    where: { id: row.id },
    data: { content: text?.slice(0, 1_000_000) ?? "" },
  });
}

export async function deleteUserFilter(db, projectId, sectionKey) {
  const latest = await getLatestUserFilter(db, projectId, sectionKey);
  if (!latest) return null;
  const version = latest.version + 1;
  return db.projectSectionFilter.create({
    data: {
      projectId,
      sectionKey,
      version,
      content: "",
      createdById: latest.createdById,
    },
  });
}

export function serializeProjectFilter(row) {
  if (!row) return null;
  const section = getSection(row.sectionKey);
  return {
    projectId: row.projectId,
    sectionKey: row.sectionKey,
    label: section.label,
    version: row.version,
    content: row.content,
    fileName: row.fileName,
    mimeType: row.mimeType,
    hasFile: Boolean(row.storageKey),
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}