import { createHash } from "node:crypto";
import prisma from "../../lib/prisma.js";

/** @type {Map<string, { loadedAt: number, ids: string[], hash: string, content: string }>} */
const cache = new Map();

const TTL_MS = 60_000;

/**
 * Platform master filters for a section (creation order), joined for prompts.
 * @param {string} sectionKey
 * @param {{ forceRefresh?: boolean }} [opts]
 */
export async function loadMasterFiltersForSection(sectionKey, opts = {}) {
  const now = Date.now();
  if (!opts.forceRefresh) {
    const hit = cache.get(sectionKey);
    if (hit && now - hit.loadedAt < TTL_MS) {
      return { ids: hit.ids, hash: hit.hash, content: hit.content };
    }
  }

  const rows = await prisma.masterFilter.findMany({
    where: { sectionKey },
    orderBy: { createdAt: "asc" },
    select: { id: true, content: true },
  });

  const ids = rows.map((r) => r.id);
  const content = rows.map((r) => r.content).join("\n\n---\n\n");
  const hash = createHash("sha256").update(content || sectionKey).digest("hex");

  const payload = { loadedAt: now, ids, hash, content };
  cache.set(sectionKey, payload);
  return { ids, hash, content };
}

export function invalidateMasterFilterCache(sectionKey) {
  if (sectionKey) cache.delete(sectionKey);
  else cache.clear();
}