/**
 * Parse / get / set payload paths like parties[0].name and financial_terms.entry_fee.
 */

const EVIDENCE_RE = /^evidence($|\.|\[)/;

export function assertWritableFieldPath(fieldPath) {
  if (typeof fieldPath !== "string" || !fieldPath.trim()) {
    throw Object.assign(new Error("fieldPath is required."), { code: 400 });
  }
  const path = fieldPath.trim();
  if (EVIDENCE_RE.test(path)) {
    throw Object.assign(
      new Error("The evidence array cannot be edited. Use Why? citations from GET."),
      { code: 400 }
    );
  }
  if (path.length > 240) {
    throw Object.assign(new Error("fieldPath is too long."), { code: 400 });
  }
  parseFieldPath(path);
  return path;
}

/**
 * @param {string} path
 * @returns {Array<{ type: "key", key: string } | { type: "index", index: number }>}
 */
export function parseFieldPath(path) {
  const tokens = [];
  let rest = path;
  while (rest.length) {
    const key = rest.match(/^([A-Za-z_][\w]*)/);
    if (key) {
      tokens.push({ type: "key", key: key[1] });
      rest = rest.slice(key[1].length);
      continue;
    }
    const idx = rest.match(/^\[(\d+)\]/);
    if (idx) {
      tokens.push({ type: "index", index: Number(idx[1]) });
      rest = rest.slice(idx[0].length);
      continue;
    }
    if (rest.startsWith(".")) {
      rest = rest.slice(1);
      if (!rest.length || rest.startsWith(".")) {
        throw Object.assign(new Error(`Invalid fieldPath "${path}".`), { code: 400 });
      }
      continue;
    }
    throw Object.assign(new Error(`Invalid fieldPath "${path}".`), { code: 400 });
  }
  if (tokens.length === 0) {
    throw Object.assign(new Error(`Invalid fieldPath "${path}".`), { code: 400 });
  }
  return tokens;
}

export function getAtPath(target, fieldPath) {
  if (target == null) return undefined;
  const tokens = parseFieldPath(fieldPath);
  let current = target;
  for (const token of tokens) {
    if (current == null) return undefined;
    current =
      token.type === "key" ? current[token.key] : current[token.index];
  }
  return current;
}

export function clonePayload(payload) {
  return payload == null ? {} : structuredClone(payload);
}

/**
 * @param {object} root
 * @param {string} fieldPath
 * @param {unknown} value
 */
export function setAtPath(root, fieldPath, value) {
  const tokens = parseFieldPath(fieldPath);
  let current = root;
  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i];
    const next = tokens[i + 1];
    if (token.type === "key") {
      if (current[token.key] == null || typeof current[token.key] !== "object") {
        current[token.key] = next.type === "index" ? [] : {};
      }
      current = current[token.key];
    } else {
      if (!Array.isArray(current)) {
        throw Object.assign(
          new Error(`fieldPath "${fieldPath}" expected an array.`),
          { code: 400 }
        );
      }
      while (current.length <= token.index) current.push(null);
      if (current[token.index] == null || typeof current[token.index] !== "object") {
        current[token.index] = next.type === "index" ? [] : {};
      }
      current = current[token.index];
    }
  }

  const last = tokens[tokens.length - 1];
  if (last.type === "key") {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      throw Object.assign(
        new Error(`fieldPath "${fieldPath}" cannot be written.`),
        { code: 400 }
      );
    }
    current[last.key] = value;
    return;
  }

  if (!Array.isArray(current)) {
    throw Object.assign(
      new Error(`fieldPath "${fieldPath}" expected an array.`),
      { code: 400 }
    );
  }
  while (current.length <= last.index) current.push(null);
  current[last.index] = value;
}

export function flattenConfidences(fieldMeta) {
  const out = {};
  if (!fieldMeta || typeof fieldMeta !== "object") return out;
  for (const [path, meta] of Object.entries(fieldMeta)) {
    if (meta && typeof meta === "object" && typeof meta.confidence === "string") {
      out[path] = meta.confidence;
    }
  }
  return out;
}
