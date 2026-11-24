/**
 * Default confirmation rules for v2 field-store sections.
 */
export const genericSectionRules = {
  blocking: [
    {
      id: "unresolved_conflicts",
      message: "Resolve or accept as gap all conflicting fields before confirming.",
      when: ({ chipCounts }) => (chipCounts?.conflict ?? 0) > 0,
    },
    {
      id: "unresolved_missing",
      message: "Accept as gap or fill all required missing fields before confirming.",
      when: ({ chipCounts, requiredMissing }) =>
        (chipCounts?.missing ?? 0) > 0 && (requiredMissing ?? 0) > 0,
    },
  ],
  warnings: [],
  reviewTabs: [{ id: "gaps", label: "Gaps" }],
};