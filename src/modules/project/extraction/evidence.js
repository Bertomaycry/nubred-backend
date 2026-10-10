/**
 * Persist Why-button evidence rows and per-field confidence metadata
 * from a section extraction payload.
 */

/**
 * @param {object} payload
 * @param {Array<{ field_path?: string }>} evidence
 * @returns {Record<string, { confidence: string, sources: string[] }>}
 */
export function buildFieldMeta(payload, evidence = []) {
  const meta = {};
  const pathsWithEvidence = new Set(
    evidence
      .map((item) => item?.field_path)
      .filter((path) => typeof path === "string" && path.length > 0)
  );

  walk(payload, "", (path, value) => {
    if (!path || path === "evidence" || path.startsWith("evidence.") || path.startsWith("evidence[")) return;
    if (value === undefined) return;

    const hasEvidence = [...pathsWithEvidence].some(
      (evPath) => evPath === path || evPath.startsWith(`${path}.`) || path.startsWith(`${evPath}.`)
    );

    if (value === null) {
      meta[path] = {
        confidence: "MISSING",
        sources: [],
      };
      return;
    }

    meta[path] = {
      confidence: hasEvidence ? "CONFIRMED" : "PROVISIONAL",
      sources: [...pathsWithEvidence].filter(
        (evPath) => evPath === path || evPath.startsWith(`${path}.`)
      ),
    };
  });

  return meta;
}

function walk(value, path, visit) {
  if (path) visit(path, value);

  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, visit));
    return;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const next = path ? `${path}.${key}` : key;
      walk(child, next, visit);
    }
  }
}

/**
 * @param {import("@prisma/client").Prisma.TransactionClient | import("@prisma/client").PrismaClient} tx
 * @param {object} params
 */
export async function persistEvidence(tx, {
  projectId,
  sectionExtractionId,
  sectionKey,
  evidence,
  documents,
}) {
  await tx.evidenceItem.deleteMany({ where: { sectionExtractionId } });

  const items = Array.isArray(evidence) ? evidence : [];
  if (items.length === 0) return;

  const byName = new Map(
    (documents ?? []).map((doc) => [doc.originalFilename.toLowerCase(), doc])
  );

  await tx.evidenceItem.createMany({
    data: items.map((item) => {
      const name = String(item.document_name ?? "").trim();
      const match = byName.get(name.toLowerCase());
      return {
        projectId,
        sectionExtractionId,
        documentId: match?.id ?? null,
        sectionKey,
        fieldPath: String(item.field_path ?? ""),
        documentName: name || "unknown",
        page: Number.isInteger(item.page) ? item.page : null,
        charOffset: Number.isInteger(item.char_offset) ? item.char_offset : null,
        quote: String(item.quote ?? ""),
        frameworkElement: item.framework_element ?? null,
      };
    }),
  });
}
