import { sanitizeFilename } from "../project/storage/keys.js";

export const MAX_FILTER_BYTES = 5 * 1024 * 1024;
export const MAX_CONTENT_CHARS = 1_000_000;
const MAX_FILE_NAME = 255;

/** Extension decides the type; browsers often send .md with an empty MIME. */
const EXTENSION_MIME = {
  md: "text/markdown",
  txt: "text/plain",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Strip path components and control characters; keep casing and spaces. */
export function sanitizeDisplayName(name) {
  const base = String(name ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .pop();
  // eslint-disable-next-line no-control-regex
  return base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_FILE_NAME);
}

/**
 * Validate an init-upload body. First failing rule wins.
 * @param {{ fileName?: unknown, mimeType?: unknown, size?: unknown }} body
 * @returns {{ ok: true, data: { fileName: string, mimeType: string, size: number } }
 *   | { ok: false, message: string }}
 */
export function parseInitUpload(body) {
  const fileName =
    typeof body?.fileName === "string" ? sanitizeDisplayName(body.fileName) : "";
  if (!fileName) return { ok: false, message: "File name is required." };

  const ext = fileName.includes(".") ? fileName.split(".").pop().toLowerCase() : "";
  const mimeType = EXTENSION_MIME[ext];
  if (!mimeType) {
    return { ok: false, message: "Use a .md, .txt, .pdf, or .docx file." };
  }

  const size = body?.size;
  if (!Number.isInteger(size) || size <= 0) {
    return { ok: false, message: "File size is required." };
  }
  if (size > MAX_FILTER_BYTES) {
    return { ok: false, message: "File is larger than 5 MB." };
  }

  return { ok: true, data: { fileName, mimeType, size } };
}

export const masterFilterKey = ({ sectionKey, uploadId, fileName }) =>
  `master-filters/${sectionKey}/${uploadId}/${sanitizeFilename(fileName)}`;

export const promotedMasterFilterKey = ({ sectionKey, userFilterId, fileName }) =>
  `master-filters/${sectionKey}/promoted-${userFilterId}/${sanitizeFilename(fileName)}`;

export const userFilterKey = ({ sectionKey, uploadId, fileName }) =>
  `user-filters/${sectionKey}/${uploadId}/${sanitizeFilename(fileName)}`;
