import { flattenConfidences, getAtPath } from "./path.js";

/**
 * @param {object} rules
 * @param {{ extraction: object | null, fieldMeta?: object | null, reviewState?: object | null }} ctx
 */
export function evaluateSectionRules(rules, ctx) {
  const extraction = ctx.extraction ?? null;
  const fieldConfidences = flattenConfidences(ctx.fieldMeta);
  const reviewState = ctx.reviewState ?? {};
  const evalCtx = { extraction, fieldConfidences, fieldMeta: ctx.fieldMeta, reviewState };

  const blocking = [];
  for (const rule of rules?.blocking ?? []) {
    if (ruleApplies(rule, evalCtx)) {
      blocking.push({ id: rule.id, message: rule.message, type: "blocking" });
    }
  }

  const warnings = [];
  for (const rule of rules?.warnings ?? []) {
    if (ruleApplies(rule, evalCtx)) {
      warnings.push({ id: rule.id, message: rule.message, type: "warning" });
    }
  }

  return { blocking, warnings, canConfirm: blocking.length === 0 };
}

function ruleApplies(rule, ctx) {
  switch (rule.type) {
    case "REQUIRED_NON_EMPTY": {
      const value = getAtPath(ctx.extraction, rule.fieldPath);
      return !Array.isArray(value) || value.length === 0;
    }
    case "NO_CONFLICTS":
      return Object.values(ctx.fieldConfidences ?? {}).includes("CONFLICTING");
    case "REVIEW_STATE":
      return ctx.reviewState?.[rule.key] !== true;
    case "CUSTOM":
      return typeof rule.check === "function" ? !!rule.check(ctx) : false;
    default:
      return false;
  }
}
