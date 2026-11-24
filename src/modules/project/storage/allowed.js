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
  "CONTRACT",
  "ANNEX_ADDENDUM",
  "PROTOCOL",
  "OFFICIAL_RECORD",
  "CORRESPONDENCE",
  "OTHER",
];

const LEGACY_DOCUMENT_TYPES = {
  SIGNED_CONTRACT: "CONTRACT",
  DRAFT_CONTRACT: "CONTRACT",
  CONTRACT_ANNEX: "ANNEX_ADDENDUM",
  ADDENDUM: "ANNEX_ADDENDUM",
  ANNEX: "ANNEX_ADDENDUM",
  PROTOCOL_DOCUMENT: "PROTOCOL",
  IP_CERTIFICATE: "OFFICIAL_RECORD",
  EMAIL: "CORRESPONDENCE",
  MEETING_NOTES: "CORRESPONDENCE",
  VCU_EVALUATION: "OTHER",
  PLANTING_PLAN: "OTHER",
  QUALITY_SPECIFICATION: "OTHER",
  SOIL_ANALYSIS: "OTHER",
};

/**
 * Map an upload hint or a free-text triage label onto one of DOCUMENT_TYPES.
 * Unknown text returns null. Empty returns null.
 * @param {unknown} value
 * @returns {(typeof DOCUMENT_TYPES)[number] | null}
 */
export function normalizeDocumentKind(value) {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (!raw) return null;
  if (DOCUMENT_TYPES.includes(raw)) return raw;
  if (LEGACY_DOCUMENT_TYPES[raw]) return LEGACY_DOCUMENT_TYPES[raw];
  if (/LICEN[CS]E|AGREEMENT|TERM_SHEET/.test(raw)) return "CONTRACT";
  if (/ANNEX|ADDEND/.test(raw)) return "ANNEX_ADDENDUM";
  if (raw.includes("PROTOCOL")) return "PROTOCOL";
  if (/CERTIFICATE|PERMIT|REGISTER/.test(raw)) return "OFFICIAL_RECORD";
  if (/EMAIL|MEETING_NOTE|CORRESPOND/.test(raw)) return "CORRESPONDENCE";
  return null;
}

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
