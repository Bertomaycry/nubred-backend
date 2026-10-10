/**
 * Confirmation blocking rules for the Genotype section.
 * Source spec: Doc F, Section 2 — Genotype: "What blocks confirmation"
 */
export const genotypeRules = {
  blocking: [
    {
      id: "no_genotypes",
      type: "REQUIRED_NON_EMPTY",
      fieldPath: "genotypes",
      message:
        "At least one genotype must be identified before the Genotype section can be confirmed.",
    },
    {
      id: "genotype_missing_species",
      type: "CUSTOM",
      message:
        "Every genotype must have a species assigned (either primary_species or per-genotype species_botanical). " +
          "Species is the minimum required field — confirm or add manually before confirming.",
      check({ extraction }) {
        if (!extraction?.genotypes?.length) return false; // handled by no_genotypes rule
        const hasNoSpecies = extraction.genotypes.some(
          (g) =>
            !g.species_botanical &&
            !extraction.primary_species_botanical
        );
        return hasNoSpecies;
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
      id: "duplicate_name_detected",
      type: "CUSTOM",
      message:
        "Two or more genotypes share the same name. " +
          "They may be the same variety referenced differently — review and merge if needed.",
      check({ extraction }) {
        if (!extraction?.genotypes?.length) return false;
        const names = extraction.genotypes
          .map((g) => g.name?.toLowerCase().trim())
          .filter(Boolean);
        return new Set(names).size < names.length;
      },
    },
    {
      id: "unknown_development_status",
      type: "CUSTOM",
      message:
        "Some genotypes have UNKNOWN development status. " +
          "Upload the PBR certificate to confirm whether they are Selections or Varieties.",
      check({ extraction }) {
        return extraction?.genotypes?.some(
          (g) => g.development_status === "UNKNOWN"
        ) ?? false;
      },
    },
  ],

  reviewTabs: [
    { id: "genotype_list", label: "Genotype List", order: 1 },
  ],
};
