/** Build nested payload for legacy chat helpers from flat field store rows. */
export function recordsToPayload(records) {
  const root = {};
  for (const record of records ?? []) {
    if (!record.groupPath) {
      for (const fv of record.fieldValues ?? []) {
        root[fv.fieldKey] = fv.value;
      }
      continue;
    }
    const parts = record.groupPath.split(".");
    let cursor = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      cursor[p] ??= {};
      cursor = cursor[p];
    }
    const leaf = parts[parts.length - 1];
    if (record.repeatable !== false) {
      cursor[leaf] ??= [];
      const item = {};
      for (const fv of record.fieldValues ?? []) {
        item[fv.fieldKey] = fv.value;
      }
      cursor[leaf].push(item);
    }
  }
  return root;
}