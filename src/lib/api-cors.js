import { slugError, tenantHostSuffix } from "../modules/client/slug.js";

/** Apex hosts the governance and marketing apps are served from. */
export const STATIC_API_ORIGINS = [
  "http://localhost:5173",
  "https://nubred.com",
  "https://www.nubred.com",
  "https://preview.nubred.com",
  "https://www.preview.nubred.com",
  "https://node.preview.nubred.com",
  "https://www.node.preview.nubred.com",
  "https://governance.nubred.com",
  "https://www.governance.nubred.com",
  "https://gov.preview.nubred.com",
  "https://www.gov.preview.nubred.com",
  "https://gov.nubred.com",
  "https://www.gov.nubred.com",
  "https://node.nubred.com",
  "https://www.node.nubred.com",
];

const STATIC = new Set(STATIC_API_ORIGINS);

/** One client label under each governance host, plus the configured suffix. */
function clientSuffixes() {
  const configured = tenantHostSuffix().replace(/^\./, "").toLowerCase();
  return [...new Set([configured, "gov.nubred.com", "gov.preview.nubred.com"])];
}

/**
 * True for a browser Origin this API will echo.
 * Missing origin (curl, server-to-server) is allowed.
 * A client workspace is https://{slug}.gov.nubred.com or the preview equivalent.
 */
export function isAllowedApiOrigin(origin) {
  if (!origin) return true;
  if (STATIC.has(origin)) return true;

  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port) return false;

  const host = url.hostname.toLowerCase();
  for (const suffix of clientSuffixes()) {
    const marker = `.${suffix}`;
    if (!host.endsWith(marker)) continue;
    const slug = host.slice(0, -marker.length);
    if (slug && !slug.includes(".") && !slugError(slug)) return true;
  }
  return false;
}
