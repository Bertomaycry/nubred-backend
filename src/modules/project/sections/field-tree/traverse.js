import { isGroup } from "./types.js";

export { isGroup } from "./types.js";

/**
 * @param {(import("./types.js").FieldDef|import("./types.js").GroupDef)[]} nodes
 * @param {{ includeDerived?: boolean }} [opts]
 */
export function walkFields(nodes, opts = {}) {
  const { includeDerived = false } = opts;
  /** @type {import("./types.js").FieldDef[]} */
  const out = [];

  function walk(list, groupPath) {
    for (const node of list ?? []) {
      if (isGroup(node)) {
        const path = groupPath ? `${groupPath}.${node.key}` : node.key;
        walk(node.children, path);
        continue;
      }
      if (!includeDerived && node.derive) continue;
      out.push({
        ...node,
        _groupPath: groupPath || null,
        _path: groupPath ? `${groupPath}.${node.key}` : node.key,
      });
    }
  }

  walk(nodes, "");
  return out;
}

/**
 * @param {(import("./types.js").FieldDef|import("./types.js").GroupDef)[]} nodes
 */
export function listGroups(nodes) {
  /** @type {{ key: string, label: string, repeatable: boolean, identity: string[], path: string }[]} */
  const out = [];

  function walk(list, prefix) {
    for (const node of list ?? []) {
      if (!isGroup(node)) continue;
      const path = prefix ? `${prefix}.${node.key}` : node.key;
      out.push({
        key: node.key,
        label: node.label,
        repeatable: Boolean(node.repeatable),
        identity: node.identity ?? [],
        path,
      });
      walk(node.children, path);
    }
  }

  walk(nodes, "");
  return out;
}

/**
 * Frontend definition tree (metadata only).
 * @param {(import("./types.js").FieldDef|import("./types.js").GroupDef)[]} nodes
 */
export function toDefinitionTree(nodes) {
  return (nodes ?? []).map((node) => {
    if (isGroup(node)) {
      return {
        kind: "group",
        key: node.key,
        label: node.label,
        repeatable: Boolean(node.repeatable),
        identity: node.identity ?? [],
        contractTypes: node.contractTypes ?? null,
        children: toDefinitionTree(node.children),
      };
    }
    return {
      kind: "field",
      key: node.key,
      label: node.label,
      type: node.type,
      options: node.options ?? null,
      ref: node.ref ?? null,
      showIf: node.showIf ?? null,
      contractTypes: node.contractTypes ?? null,
      required: Boolean(node.required),
      derive: node.derive ? { from: node.derive.from, fn: node.derive.fn } : null,
      uiGroup: node.uiGroup ?? null,
      combo: node.combo ?? null,
      readOnly: Boolean(node.derive),
    };
  });
}