/**
 * Confirmation blocking rules for the Phase section.
 * Source spec: Doc F, Section 4 — Phases: "What blocks confirmation"
 */
export const phaseRules = {
  blocking: [
    {
      id: "no_phases",
      type: "REQUIRED_NON_EMPTY",
      fieldPath: "phases",
      message:
        "At least one active phase is required. A project with no phases cannot be confirmed.",
    },
    {
      id: "phase_missing_type",
      type: "CUSTOM",
      message:
        "Every phase must have a type assigned (TRIAL, PILOT, LAUNCH, SCALE, or CUSTOM). " +
          "Assign the type manually before confirming.",
      check({ extraction }) {
        return extraction?.phases?.some((p) => !p.type) ?? false;
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
      id: "custom_phase_present",
      type: "CUSTOM",
      message:
        "A CUSTOM phase type is present. Custom phases require configuration by the NuBred team " +
          "to define observation protocols and gate logic. Contact support.",
      check({ extraction }) {
        return extraction?.phases?.some((p) => p.type === "CUSTOM") ?? false;
      },
    },
    {
      id: "no_gate_criteria",
      type: "CUSTOM",
      message:
        "One or more phases have no gate criteria defined. " +
          "NuBred standard gate criteria apply by default, but project-specific conditions should be confirmed.",
      check({ extraction }) {
        return extraction?.phases?.some(
          (p) => !p.gate_criteria || p.gate_criteria.length === 0
        ) ?? false;
      },
    },
  ],

  reviewTabs: [
    { id: "phase_timeline", label: "Phase Timeline", order: 1 },
  ],
};
