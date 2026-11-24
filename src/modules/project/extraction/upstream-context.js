import { getReadingOrderSections } from "../sections/registry.js";
import { listSectionRecords, groupIdentityFor } from "../field-store/repository.js";

/**
 * Compact digest for upstream sections (ids + identity fields only).
 */
export async function buildUpstreamContext(db, projectId, sectionKey, enabledKeys) {
  const ordered = getReadingOrderSections(enabledKeys);
  const self = ordered.find((x) => x.key === sectionKey);
  const selfOrder = self?.order ?? 999;
  const upstream = ordered.filter(
    (s) => s.key !== sectionKey && s.order < selfOrder
  );

  const parts = [];
  for (const section of upstream) {
    const records = await listSectionRecords(db, projectId, section.key);
    if (!records.length) continue;

    const contextKeys = new Set(section.contextFields ?? []);
    const lines = [`## ${section.key}`];
    for (const record of records) {
      const idLine = `record ${record.id} (${record.groupPath || "root"})`;
      const fields = record.fieldValues
        .filter((f) => contextKeys.has(f.fieldKey))
        .map((f) => `${f.fieldKey}: ${JSON.stringify(f.value)}`);
      lines.push([idLine, ...fields].join("\n"));
    }
    parts.push(lines.join("\n"));
  }

  return parts.join("\n\n");
}