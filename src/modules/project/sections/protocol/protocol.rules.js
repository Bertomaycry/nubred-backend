/**
 * Confirmation blocking rules for the Protocol section.
 * Source spec: Doc F, Section — Protocols & Observations: "How VM confirms"
 *
 * Note: GET /api/protocols/active is deferred to after the 5 creation steps
 * work end to end. The data model is designed to support it from day one.
 */
export const protocolRules = {
  blocking: [
    {
      id: "no_protocols",
      type: "REQUIRED_NON_EMPTY",
      fieldPath: "protocols",
      message:
        "At least one protocol must be identified before the Protocol section can be confirmed.",
    },
    {
      id: "protocol_missing_parameters",
      type: "CUSTOM",
      message:
        "Every protocol must have at least one observation parameter. " +
          "Add or confirm parameters before confirming the section.",
      check({ extraction }) {
        return extraction?.protocols?.some(
          (p) => !p.parameters || p.parameters.length === 0
        ) ?? false;
      },
    },
    {
      id: "protocol_missing_phase_link",
      type: "CUSTOM",
      message:
        "Every protocol must be linked to a phase (TRIAL, PILOT, LAUNCH, SCALE, or CUSTOM). " +
          "Assign the phase link before confirming.",
      check({ extraction }) {
        return extraction?.protocols?.some((p) => !p.linked_phase) ?? false;
      },
    },
    {
      id: "unresolved_conflicts",
      type: "NO_CONFLICTS",
      message: "All Conflicting fields must be resolved before confirming.",
    },
  ],

  warnings: [
    {
      id: "no_eliminatory_criteria",
      type: "CUSTOM",
      message:
        "No eliminatory criteria are defined. " +
          "At least one L2 Species Standard criterion (e.g. minimum Brix) is typically required. " +
          "Confirm intentionally or add criteria.",
      check({ extraction }) {
        const allParams = extraction?.protocols?.flatMap((p) => p.parameters ?? []) ?? [];
        return !allParams.some((p) => p.eliminatory_level != null);
      },
    },
    {
      id: "field_observer_not_assigned",
      type: "CUSTOM",
      message:
        "Field Observer assignments are not set. " +
          "Assign Field Observers to genotypes after confirming the Protocol section.",
      // Field Observer assignment happens post-confirmation, not during extraction.
      // This is a reminder, not a blocker.
      check() { return true; },
    },
  ],

  reviewTabs: [
    { id: "protocol_parameters", label: "Parameters", order: 1 },
    { id: "eliminatory_criteria", label: "Eliminatory Criteria", order: 2 },
  ],
};
