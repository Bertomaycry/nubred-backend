/**
 * Upload policy for project documents.
 * Defaults are conservative; override via env without a code change.
 */

export const DEFAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

export function getMaxUploadBytes() {
  const raw = process.env.NUBRED_MAX_UPLOAD_BYTES;
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_MAX_UPLOAD_BYTES;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_UPLOAD_BYTES;
}

export const ALLOWED_MIME_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "text/plain": "txt",
  "text/csv": "csv",
  "message/rfc822": "eml",
};

const EXTENSION_TO_MIME = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  txt: "text/plain",
  csv: "text/csv",
  eml: "message/rfc822",
};

export const DOCUMENT_TYPES = [
  "SIGNED_CONTRACT",
  "DRAFT_CONTRACT",
  "CONTRACT_ANNEX",
  "IP_CERTIFICATE",
  "EMAIL",
  "PROTOCOL_DOCUMENT",
  "VCU_EVALUATION",
  "PLANTING_PLAN",
  "MEETING_NOTES",
  "QUALITY_SPECIFICATION",
  "SOIL_ANALYSIS",
  "OTHER",
];

/**
 * Infer a canonical MIME type from the declared type or filename extension.
 * Returns null if the file is not allowed.
 *
 * @param {string} mimeType
 * @param {string} filename
 * @returns {string | null}
 */
export function resolveAllowedMimeType(mimeType, filename) {
  const declared = String(mimeType ?? "").toLowerCase().split(";")[0].trim();
  if (ALLOWED_MIME_TYPES[declared]) return declared;

  const ext = String(filename ?? "").split(".").pop()?.toLowerCase();
  if (ext && EXTENSION_TO_MIME[ext]) return EXTENSION_TO_MIME[ext];

  return null;
}

/**
 * @param {{ filename: string, mimeType: string, size: number }} file
 * @returns {{ ok: true, mimeType: string } | { ok: false, message: string }}
 */
export function validateUploadFile({ filename, mimeType, size }) {
  if (!filename || typeof filename !== "string") {
    return { ok: false, message: "Each file must include a filename." };
  }

  const resolved = resolveAllowedMimeType(mimeType, filename);
  if (!resolved) {
    return {
      ok: false,
      message:
        `"${filename}" is not an allowed type. ` +
        "Accepted: PDF, DOCX, XLSX, XLS, TXT, CSV, EML. Convert .doc files to .docx.",
    };
  }

  const max = getMaxUploadBytes();
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, message: `"${filename}" is missing a valid size.` };
  }
  if (size > max) {
    return {
      ok: false,
      message: `"${filename}" exceeds the ${Math.round(max / (1024 * 1024))} MB upload limit.`,
    };
  }

  return { ok: true, mimeType: resolved };
}
