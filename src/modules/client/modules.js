/**
 * The 13 feature flags the admin Add/Edit Client screens toggle.
 * Ids are stable; order is the order of the UI and of `moduleIds` in the API.
 * See docs/NuBred_Client_Module_Backend_Guide.html section 07.
 */
export const MODULES = [
  { id: "contract", label: "Contract", ai: false },
  { id: "genotype", label: "Genotype", ai: false },
  { id: "phase", label: "Phase", ai: false },
  { id: "protocol", label: "Protocol", ai: false },
  { id: "field_observation", label: "Field Observation", ai: false },
  { id: "timeline", label: "Timeline", ai: false },
  { id: "model_supply_chain", label: "Model & Supply Chain", ai: false },
  { id: "todo", label: "To Do", ai: false },
  { id: "ip_right", label: "IP Right", ai: false },
  { id: "quarantine", label: "Quarantine", ai: false },
  { id: "predictive_genotype_analysis", label: "Predictive Genotype Analysis", ai: true },
  { id: "ai_protocol_generation", label: "AI Protocol Generation & Scheduling", ai: true },
  { id: "contract_risk_analysis", label: "Contract Clause & Risk Analysis", ai: true },
];

export const MODULE_IDS = MODULES.map((m) => m.id);

/** Modules whose successful calls write AI credits. */
export const AI_MODULE_IDS = MODULES.filter((m) => m.ai).map((m) => m.id);

export function isModuleId(id) {
  return MODULE_IDS.includes(id);
}

/**
 * @param {Array<{ moduleId: string, enabled: boolean }>} rows
 * @returns {string[]} enabled module ids in UI order
 */
export function enabledModuleIds(rows) {
  const enabled = new Set(
    (rows ?? []).filter((row) => row.enabled).map((row) => row.moduleId)
  );
  return MODULE_IDS.filter((id) => enabled.has(id));
}
